-- =============================================================================
-- 039 — Supabase Realtime sur la table messages (DM temps réel)
-- =============================================================================
-- Contexte : jusqu'ici, seule la table `notifications` était publiée sur
-- `supabase_realtime` (mig. 038). Les messages d'une conversation ne se
-- rafraîchissaient qu'au re-fetch manuel (ouverture de conv, envoi). Côté
-- destinataire, un nouveau message n'apparaissait pas tant qu'il ne rouvrait
-- pas la conversation.
--
-- Cette migration ajoute `messages` à la publication Realtime pour que le
-- client puisse s'abonner à postgres_changes (INSERT) et injecter les
-- nouveaux messages en live dans le thread + la liste.
--
-- Sécurité : Realtime applique la RLS de la table. La policy
-- `messages_select_in_conv` (mig. 014) garantit qu'un utilisateur ne reçoit
-- en Realtime que les messages des conversations dont il est participant —
-- aucune fuite cross-conversation. Aucune nouvelle policy nécessaire.
--
-- REPLICA IDENTITY FULL : le payload Realtime doit porter conversation_id et
-- sender_id (colonnes lues côté client pour router le message vers la bonne
-- conversation et ignorer ses propres envois). Sans FULL, un payload d'INSERT
-- porte déjà toutes les colonnes neuves, mais on aligne sur le pattern de la
-- table notifications (mig. 038) pour homogénéité et robustesse des filtres.
--
-- Idempotent : on ne ré-ajoute pas la table si elle est déjà publiée
-- (sinon erreur 42710 "relation is already member of publication").

begin;

alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

commit;
