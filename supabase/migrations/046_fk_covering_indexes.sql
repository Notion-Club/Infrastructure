-- Migration 046 — Index de couverture sur les clés étrangères non indexées
--
-- Date    : 2026-06-27
-- Auteur  : Notion Club Infra
-- Module  : transverse (community, auth, formation, billing)
--
-- Pitch
-- -----
-- L'advisor Supabase (unindexed_foreign_keys) signale des FK sans index de
-- couverture. Conséquence : les reverse-lookups (« toutes les réactions de cet
-- user », « toutes les notifs liées à ce post ») et surtout les CASCADE de
-- suppression (supprimer un profil/post → scan séquentiel des tables filles)
-- deviennent O(n) à mesure que les volumes montent.
--
-- Ajout d'un index B-tree sur chaque colonne FK signalée. 100 % additif et
-- réversible (DROP INDEX), `if not exists` → idempotent. Sur les volumes actuels
-- la création est instantanée ; on les pose maintenant pour ne pas avoir à le
-- faire à chaud plus tard.
--
-- NB : pas de CREATE INDEX CONCURRENTLY (interdit en transaction) — inutile ici
-- vu la taille des tables. À reconsidérer si une table dépasse ~100k lignes.
-- =============================================================================

begin;

-- Community — DM
create index if not exists messages_sender_id_idx
  on public.messages (sender_id);
create index if not exists message_reactions_user_id_idx
  on public.message_reactions (user_id);

-- Community — feed (comments / replies / reactions)
create index if not exists comment_reactions_user_id_idx
  on public.comment_reactions (user_id);
create index if not exists comment_replies_author_id_idx
  on public.comment_replies (author_id);
create index if not exists comment_replies_mentioned_user_id_idx
  on public.comment_replies (mentioned_user_id);
create index if not exists post_reactions_user_id_idx
  on public.post_reactions (user_id);

-- Community — notifications (mig. 038)
create index if not exists notifications_actor_id_idx
  on public.notifications (actor_id);
create index if not exists notifications_post_id_idx
  on public.notifications (post_id);
create index if not exists notifications_comment_id_idx
  on public.notifications (comment_id);
create index if not exists notifications_conversation_id_idx
  on public.notifications (conversation_id);

-- Community — emails DM (mig. 030)
create index if not exists dm_email_notifications_conversation_id_idx
  on public.dm_email_notifications (conversation_id);
create index if not exists dm_email_notifications_triggered_by_message_id_idx
  on public.dm_email_notifications (triggered_by_message_id);

-- Auth / billing / formation
create index if not exists companies_created_by_idx
  on public.companies (created_by);
create index if not exists membership_changes_changed_by_idx
  on public.membership_changes (changed_by);
create index if not exists membership_changes_profile_id_idx
  on public.membership_changes (profile_id);
create index if not exists memberships_organization_id_idx
  on public.memberships (organization_id);
create index if not exists formation_course_notes_course_id_idx
  on public.formation_course_notes (course_id);

commit;
