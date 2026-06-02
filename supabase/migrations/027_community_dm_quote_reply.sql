-- Migration 027 — Brique Community — Quote-reply persistant sur DM
--
-- Date    : 2026-06-02
-- Auteur  : Notion Club Infra
-- Module  : community (DM 1-1)
--
-- Pitch
-- -----
-- L'UX cible DM (refonte MessageBubble) introduit la fonctionnalité "Répondre
-- à un message" façon WhatsApp : un quote-block apparaît au-dessus du body
-- du nouveau message, avec l'auteur original + un extrait du message cité.
--
-- Stockage : on ajoute reply_to_message_id (FK soft) + 2 colonnes dénormalisées
-- (reply_snippet, reply_author_name) sur messages. La dénormalisation est
-- volontaire — elle permet au quote-block de SURVIVRE à la suppression du
-- message original (RGPD-friendly : on n'expose pas le body soft-deleted,
-- on garde juste le snippet figé au moment de l'envoi).
--
-- Pourquoi dénormaliser plutôt que joindre ?
-- ----------------------------------------------------------------------------
-- 1. Le message cité peut être soft-deleted (deleted=true) → on ne veut PAS
--    afficher son body actuel (RGPD : l'auteur a demandé la suppression).
-- 2. Le snippet est figé au moment de l'envoi, donc immuable même si l'auteur
--    édite ensuite son message original. C'est la sémantique WhatsApp : "ce
--    que la personne a vraiment vu/répondu, c'est ÇA".
-- 3. Une jointure SELECT-time obligerait à un LEFT JOIN messages_replied
--    sur chaque page de thread → cout x2 sur le hot path render messages.
--
-- ⚠️ Ticket Sensible
-- reply_snippet est tronqué à 280 chars côté server action (cf. validation.ts).
-- Si la limite change un jour, il faudra reflechir au backfill — pour l'instant
-- une nouvelle limite ne s'applique qu'aux nouveaux quote-replies (existants
-- gardent leur snippet figé).
-- =============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Colonnes quote-reply
-- ----------------------------------------------------------------------------
alter table public.messages
  -- FK soft : ON DELETE SET NULL pour ne pas perdre le quote si l'original
  -- est hard-deleted (cas rare — la suppression standard est soft via
  -- deleted=true, qui préserve la FK).
  add column if not exists reply_to_message_id uuid
    references public.messages(id) on delete set null,
  -- Snippet figé du message cité au moment de l'envoi (extrait des 280
  -- premiers chars). Permet d'afficher le quote-block sans jointure et
  -- sans exposer le body soft-deleted.
  add column if not exists reply_snippet text,
  -- Nom de l'auteur original figé au moment de l'envoi. Évite une jointure
  -- profiles supplémentaire au render.
  add column if not exists reply_author_name text;

comment on column public.messages.reply_to_message_id is
  'FK soft vers le message cité. ON DELETE SET NULL pour préserver le quote '
  'si l''original est hard-deleted. Le rendu utilise reply_snippet/'
  'reply_author_name dénormalisés, pas une jointure sur cette FK.';

comment on column public.messages.reply_snippet is
  'Extrait (≤ 280 chars) du body du message cité, figé à l''envoi. Affiché '
  'dans le quote-block au-dessus du body du nouveau message. Survit à la '
  'suppression / l''édition du message original (sémantique WhatsApp).';

comment on column public.messages.reply_author_name is
  'Nom de l''auteur du message cité, figé à l''envoi. Évite une jointure '
  'profiles. Survit à la suppression du profil (display name affiché tel '
  'quel, pas de fallback "Membre supprimé" appliqué côté query).';

-- ----------------------------------------------------------------------------
-- Contrainte d'intégrité métier
-- ----------------------------------------------------------------------------
-- Soit les 3 colonnes sont remplies (quote-reply), soit aucune (message normal).
-- Évite les états incohérents type "snippet sans FK" ou "FK sans snippet".
alter table public.messages
  drop constraint if exists messages_quote_reply_consistency;

alter table public.messages
  add constraint messages_quote_reply_consistency check (
    (reply_to_message_id is null and reply_snippet is null and reply_author_name is null)
    or (reply_snippet is not null and reply_author_name is not null)
  );

-- Index pour les "messages qui me répondent" (utile pour notifs V1 plus tard).
-- WHERE clause filtre les NULL → index partiel, léger.
create index if not exists messages_reply_to_idx
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

-- Pas de policy RLS dédiée — les colonnes héritent des policies messages
-- existantes (SELECT par participant, INSERT par sender_id = auth.uid()).

commit;
