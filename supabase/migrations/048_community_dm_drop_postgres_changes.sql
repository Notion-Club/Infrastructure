-- =============================================================================
-- 048 — Brique Community — Retrait du filet postgres_changes sur messages
-- =============================================================================
-- Date    : 2026-06-28
-- Auteur  : Notion Club Infra
-- Module  : community (DM 1-1)
--
-- Pitch
-- -----
-- La mig. 047 a basculé le DM temps réel sur Broadcast from Database (fan-out
-- O(participants)), tout en CONSERVANT temporairement l'ancien chemin
-- postgres_changes (mig. 039) comme FILET DE SÉCURITÉ côté client, le temps de
-- valider le broadcast en conditions réelles (2 sessions). Le broadcast est
-- désormais confirmé en prod → on encaisse le vrai gain de scalabilité en
-- retirant le filet.
--
-- Ce que fait cette migration
-- ---------------------------
-- 1. Retire public.messages de la publication supabase_realtime (annule l'ajout
--    de la mig. 039). Plus aucun client ne reçoit la table messages via
--    postgres_changes → fin du fan-out O(users connectés).
-- 2. Repasse messages en REPLICA IDENTITY DEFAULT (la mig. 039 l'avait mise en
--    FULL pour que le payload postgres_changes porte conversation_id/sender_id).
--    Le broadcast (mig. 047) lit NEW dans le trigger AFTER INSERT — NEW est
--    toujours pleinement peuplé quelle que soit la replica identity → aucun
--    besoin de FULL. Repasser en DEFAULT (clé primaire) réduit le volume WAL.
--
-- Ce que cette migration NE touche PAS
-- ------------------------------------
-- - La table notifications reste publiée (centre de notifs in-app, mig. 038).
-- - Les triggers de broadcast (mig. 047), de notification (mig. 038) et d'email
--   (DM email) restent en place : ils n'ont jamais dépendu de la publication.
-- - Le réglage Realtime « Allow public access » doit RESTER activé (le canal de
--   frappe nc-typing:* est public et en dépend ; sans rapport avec messages).
--
-- Idempotent : on ne retire la table que si elle est encore publiée (sinon la
-- ré-exécution échouerait).
-- =============================================================================

begin;

-- 1. Retrait de messages de la publication Realtime (réversible : un futur
--    `alter publication supabase_realtime add table public.messages` la remet).
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime drop table public.messages;
  end if;
end;
$$;

-- 2. Retour à la replica identity par défaut (clé primaire) — FULL n'était utile
--    que pour le payload postgres_changes, désormais retiré.
alter table public.messages replica identity default;

commit;
