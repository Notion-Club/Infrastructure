-- Migration 023 — Brique Community — DM unreadCount via last_read_at
--
-- Date    : 2026-06-02
-- Auteur  : Notion Club Infra
-- Module  : community (DM 1-1)
--
-- Pitch
-- -----
-- Le type TS Conversation.unreadCount était jusqu'ici dénormalisé en
-- mémoire client uniquement, sans persistance DB. Conséquence : un user
-- qui ouvrait une conv depuis un device A continuait à voir un badge non-lu
-- sur le device B après refresh.
--
-- On dénormalise désormais "où en est chaque participant dans sa lecture"
-- directement sur la ligne conversations, via deux timestamps last_read_a_at
-- et last_read_b_at — un par participant. Le calcul de l'unreadCount devient
-- alors une simple agrégation :
--
--   count(messages WHERE conversation_id = ? AND created_at > last_read_X_at
--                  AND sender_id != caller_id)
--
-- Pas de DELETE/RESET prévu : marquer comme lu = bump last_read_X_at = now().
--
-- Pourquoi 2 colonnes plutôt qu'une table dédiée conversation_participants ?
-- ----------------------------------------------------------------------------
-- Le schéma 014 modélise les conversations en 1-1 strict (UNIQUE
-- participant_a × participant_b + CHECK a < b). Tant qu'on reste sur ce
-- modèle, deux colonnes sont strictement isomorphes à une table de
-- jointure et plus performantes (pas de JOIN sur SELECT). Si V2 introduit
-- du group DM (3+ participants), on bascule alors vers conversation_participants
-- avec une migration dédiée.
-- =============================================================================

begin;

-- Colonnes dénormalisées : timestamp de dernière lecture par participant.
-- DEFAULT now() : un participant qui vient d'être ajouté à la conv (à la
-- création) n'a pas de messages non-lus de son propre côté — il est à jour.
-- NOT NULL pour simplifier les agrégations en aval (pas de COALESCE partout).
alter table public.conversations
  add column if not exists last_read_a_at timestamptz not null default now(),
  add column if not exists last_read_b_at timestamptz not null default now();

comment on column public.conversations.last_read_a_at is
  'Timestamp de dernière lecture par participant_a. Bumpé par '
  'markConversationReadAction quand A ouvre la conv. unreadCount = '
  'count(messages where created_at > last_read_a_at and sender_id != participant_a_id).';

comment on column public.conversations.last_read_b_at is
  'Timestamp de dernière lecture par participant_b. Symétrique de last_read_a_at.';

-- Pas d'index dédié : ces colonnes ne servent que de scalaires sur des
-- lignes déjà retournées via la PK (conversations.id). Les agrégations
-- sur messages utilisent l'index existant (conversation_id, created_at).

commit;
