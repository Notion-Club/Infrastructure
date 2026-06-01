-- Migration 022 — Brique Community — mentions structurées sur les replies
--
-- Date    : 2026-06-02
-- Auteur  : Notion Club Infra
-- Module  : community (suite de 020_community_author_tier_and_counters.sql)
--
-- Pitch
-- -----
-- La table comment_replies a une colonne mentioned_user_id qui ne peut
-- porter qu'UNE seule mention par reply (FK ON DELETE SET NULL). Le front
-- supporte désormais N mentions @user via le picker du composer, comme on
-- l'a fait pour comments via comment_mentions (mig. 020).
--
-- On introduit comment_reply_mentions, table de jointure dédiée aux
-- replies. Mêmes principes que comment_mentions : RLS auteur-only pour
-- INSERT/DELETE, SELECT visible à tout viewer qui voit la reply parente.
--
-- ⚠️ Ticket Sensible
-- mentioned_user_id sur comment_replies reste en place — on ne le touche
-- pas pour rester rétrocompatible (l'UI lit toujours cette colonne et la
-- fusionne avec comment_reply_mentions côté queries). À terme une PR
-- pourra dépréquer ce singleton si on confirme qu'aucun consumer n'en
-- dépend plus.
-- =============================================================================

begin;

-- Table de jointure : N mentions par reply.
create table if not exists public.comment_reply_mentions (
  id                 uuid primary key default gen_random_uuid(),
  comment_reply_id   uuid not null references public.comment_replies(id) on delete cascade,
  mentioned_user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (comment_reply_id, mentioned_user_id)
);

comment on table public.comment_reply_mentions is
  'Mentions @user extraites du corps d''une reply. Une ligne par (reply, user mentionné). '
  'Complète comment_replies.mentioned_user_id (legacy singleton, conservé).';
comment on column public.comment_reply_mentions.comment_reply_id is
  'Reply source. ON DELETE CASCADE : disparaît avec la reply.';
comment on column public.comment_reply_mentions.mentioned_user_id is
  'Profil mentionné. ON DELETE CASCADE : si le profil est supprimé, ses mentions partent.';

-- Index recherche inverse ("replies où j'ai été mentionné").
create index if not exists comment_reply_mentions_mentioned_user_idx
  on public.comment_reply_mentions (mentioned_user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS — calqué sur comment_mentions (migration 020 §D.4)
-- ----------------------------------------------------------------------------
alter table public.comment_reply_mentions enable row level security;

-- SELECT : visible si la reply parente est elle-même visible (RLS appliquée
-- via EXISTS sur comment_replies, qui filtre par visibilité du comment / post).
drop policy if exists comment_reply_mentions_select_via_reply on public.comment_reply_mentions;
create policy comment_reply_mentions_select_via_reply
  on public.comment_reply_mentions for select to authenticated
  using (
    exists (
      select 1 from public.comment_replies cr
      where cr.id = comment_reply_mentions.comment_reply_id
    )
  );

-- INSERT : seul l'auteur de la reply peut insérer une mention.
drop policy if exists comment_reply_mentions_insert_author on public.comment_reply_mentions;
create policy comment_reply_mentions_insert_author
  on public.comment_reply_mentions for insert to authenticated
  with check (
    exists (
      select 1 from public.comment_replies cr
      where cr.id = comment_reply_mentions.comment_reply_id
        and cr.author_id = (select auth.uid())
    )
  );

-- DELETE : l'auteur de la reply peut retirer une mention (édition du body
-- qui retire un @user). Cascade FK couvre la suppression de la reply.
drop policy if exists comment_reply_mentions_delete_author on public.comment_reply_mentions;
create policy comment_reply_mentions_delete_author
  on public.comment_reply_mentions for delete to authenticated
  using (
    exists (
      select 1 from public.comment_replies cr
      where cr.id = comment_reply_mentions.comment_reply_id
        and cr.author_id = (select auth.uid())
    )
  );

-- Pas de policy UPDATE : immuable (delete + insert si nécessaire).

commit;
