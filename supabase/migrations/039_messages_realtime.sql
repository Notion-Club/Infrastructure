-- =============================================================================
-- 039 — Supabase Realtime sur la table messages (DM temps réel)
-- =============================================================================
-- Jusqu'ici seule la table notifications était publiée sur supabase_realtime
-- (mig. 038). Les messages d'une conversation ne se rafraîchissaient qu'au
-- re-fetch manuel : côté destinataire, un nouveau message n'apparaissait pas
-- tant qu'il ne rouvrait pas la conversation.
--
-- Cette migration publie public.messages pour que le client puisse s'abonner à
-- postgres_changes (INSERT) et injecter les nouveaux messages en live.
--
-- Sécurité : Realtime applique la RLS de la table. messages_select_in_conv
-- (mig. 014) garantit qu'un utilisateur ne reçoit en Realtime QUE les messages
-- des conversations dont il est participant — aucune fuite cross-conversation.
-- Aucune nouvelle policy nécessaire.
--
-- REPLICA IDENTITY FULL : pour que le payload porte conversation_id + sender_id
-- (lus côté client pour router le message vers la bonne conv et ignorer ses
-- propres envois). Aligné sur le pattern de la table notifications (mig. 038).
--
-- Idempotent : on ne ré-ajoute pas la table si déjà publiée (sinon 42710).

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
