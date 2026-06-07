-- ============================================================================
-- 030 — Queue de notifications email pour les nouveaux DM
-- ============================================================================
-- Objectif : envoyer un email à l'utilisateur destinataire d'un DM s'il n'a
-- pas lu la conversation dans les ~2 minutes après réception. Évite le spam
-- en groupant tous les messages d'un même expéditeur sur cette fenêtre :
-- 5 messages envoyés en 90s → 1 seul email.
--
-- Architecture :
--   - Trigger sur INSERT INTO messages → upsert dans dm_email_notifications
--     avec scheduled_for = NOW() + 2 minutes.
--   - Si une notification "pending" existe déjà pour (recipient, conv), on
--     bump triggered_by_message_id mais on NE BUMP PAS scheduled_for (sinon
--     un user qui tape sans arrêt repousserait l'email indéfiniment).
--   - Une route /api/cron/send-dm-emails sélectionne les notifs prêtes à
--     envoyer (sent_at IS NULL AND scheduled_for <= NOW()), vérifie les
--     préférences et l'état "lu" courant, puis envoie via Resend.

-- ----------------------------------------------------------------------------
-- Table queue
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dm_email_notifications (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id          uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  -- Pointe vers le dernier message ayant déclenché la notif. Sert au cron
  -- pour rappeler "X messages depuis le dernier email lu" si besoin.
  triggered_by_message_id  uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  -- Fenêtre de debounce : NOW() + 2 minutes lors de l'insertion. Reste fixe
  -- même si d'autres messages arrivent (cf. trigger ci-dessous).
  scheduled_for            timestamptz NOT NULL,
  -- NULL = pending. Stamp quand l'email a été envoyé OU annulé (cf. cron).
  sent_at                  timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Une seule notif pending par (destinataire, conv) — c'est la garantie qui
-- permet le debounce. L'upsert dans le trigger se base sur cet index.
CREATE UNIQUE INDEX IF NOT EXISTS dm_email_notifications_pending_unique
  ON public.dm_email_notifications (recipient_id, conversation_id)
  WHERE sent_at IS NULL;

-- Index secondaire pour le scan du cron : ramasser les notifs prêtes.
CREATE INDEX IF NOT EXISTS dm_email_notifications_ready_idx
  ON public.dm_email_notifications (scheduled_for)
  WHERE sent_at IS NULL;

-- ----------------------------------------------------------------------------
-- Trigger d'enrichissement de la queue à chaque INSERT INTO messages
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER pour by-passer la RLS : le trigger doit pouvoir écrire
-- dans dm_email_notifications sans les permissions du caller.
CREATE OR REPLACE FUNCTION public.enqueue_dm_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipient_id uuid;
  v_participant_a uuid;
  v_participant_b uuid;
BEGIN
  -- Pas de notif sur les messages supprimés (théoriquement impossible à
  -- l'INSERT mais defensive).
  IF NEW.deleted IS TRUE THEN RETURN NEW; END IF;

  -- Récupère les 2 participants pour identifier le destinataire (l'autre).
  SELECT participant_a_id, participant_b_id
    INTO v_participant_a, v_participant_b
    FROM public.conversations
   WHERE id = NEW.conversation_id;

  IF v_participant_a IS NULL THEN RETURN NEW; END IF;

  -- Le destinataire est celui qui N'EST PAS sender_id.
  IF NEW.sender_id = v_participant_a THEN
    v_recipient_id := v_participant_b;
  ELSE
    v_recipient_id := v_participant_a;
  END IF;

  -- Upsert : si une notif pending existe pour (recipient, conv), on bump
  -- juste le message déclencheur. Sinon on crée avec scheduled_for fixe.
  INSERT INTO public.dm_email_notifications
    (recipient_id, conversation_id, triggered_by_message_id, scheduled_for)
  VALUES
    (v_recipient_id, NEW.conversation_id, NEW.id, now() + interval '2 minutes')
  ON CONFLICT (recipient_id, conversation_id)
    WHERE sent_at IS NULL
  DO UPDATE SET
    triggered_by_message_id = EXCLUDED.triggered_by_message_id;
    -- IMPORTANT : on ne bump PAS scheduled_for ici. Si on le faisait, un
    -- utilisateur qui tape en continu repousserait son propre email
    -- indéfiniment et le destinataire ne serait jamais notifié.

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_dm_email_notification ON public.messages;
CREATE TRIGGER trg_enqueue_dm_email_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_dm_email_notification();

-- ----------------------------------------------------------------------------
-- RLS — verrou total côté users (seul le service role lit/écrit)
-- ----------------------------------------------------------------------------
-- Aucun client ne doit voir cette table. Le service_role bypasse la RLS
-- de toute façon (clé Vercel cron). Si un user authentifié essaie de lire,
-- il obtient une réponse vide — pas d'info leak.
ALTER TABLE public.dm_email_notifications ENABLE ROW LEVEL SECURITY;

-- Pas de policy → personne ne peut SELECT/INSERT/UPDATE/DELETE en
-- non-service-role. Le trigger SECURITY DEFINER bypass.

-- ----------------------------------------------------------------------------
-- Notification preference par défaut — opt-in plutôt qu'opt-out forcé
-- ----------------------------------------------------------------------------
-- La table notification_preferences existe déjà (mig. 004). On ajoute la
-- catégorie "community_messages" si elle n'est pas déjà créée pour les
-- users existants. Sinon les nouveaux DM ne seraient envoyés à personne
-- (faute de ligne préf = on assume opt-out).
INSERT INTO public.notification_preferences (user_id, category, channel, enabled)
SELECT
  p.id,
  'community_messages',
  'email',
  TRUE
FROM public.profiles p
ON CONFLICT (user_id, category, channel) DO NOTHING;
