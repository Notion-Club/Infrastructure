-- Migration 045 — Brique Community — RPC résumé de conversation (perf sidebar)
--
-- Date    : 2026-06-27
-- Auteur  : Notion Club Infra
-- Module  : community (DM 1-1)
--
-- Pitch
-- -----
-- listConversations() chargeait JUSQU'ICI l'INTÉGRALITÉ des messages des 100
-- dernières conversations (un .in("conversation_id", ids) SANS limite) pour en
-- dériver, côté JS, le dernier message + l'unreadCount de chaque conversation.
-- Coût O(total messages) : tient à 69 messages, s'effondre à 50 000.
--
-- Cette migration déplace ce calcul en base, borné et indexé, via UN seul RPC :
--   community_conversation_summaries(p_conversation_ids uuid[])
-- qui renvoie, pour chaque conversation de la page (≤ 100 ids) :
--   - le dernier message NON supprimé (DISTINCT ON, impossible via PostgREST) ;
--   - l'unreadCount du caller (count borné par son last_read_X_at — mig. 023).
--
-- La sidebar passe ainsi de O(total messages) à O(nb conversations affichées).
-- Les deux sous-requêtes s'appuient sur l'index messages_conversation_idx
-- (conversation_id, created_at desc) déjà présent (mig. 014).
--
-- Sécurité
-- --------
-- SECURITY INVOKER : la fonction s'exécute avec les droits de l'appelant, donc
-- les RLS de conversations (participants) et messages (participants) s'appliquent
-- en plus du filtre explicite. `set search_path = ''` (durcissement, advisor
-- function_search_path_mutable) → tout est schéma-qualifié. EXECUTE retiré à anon
-- (énumération non authentifiée), accordé à authenticated (style mig. 041).
-- =============================================================================

begin;

create or replace function public.community_conversation_summaries(
  p_conversation_ids uuid[]
)
returns table (
  conversation_id         uuid,
  last_message_sender_id  uuid,
  last_message_type       text,
  last_message_body       text,
  last_message_file_name  text,
  last_message_created_at  timestamptz,
  unread                  integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    -- Conversations de la page dont le caller est participant + son seuil de
    -- lecture (last_read selon qu'il est participant_a ou _b).
    select
      c.id,
      (select auth.uid()) as me,
      case
        when c.participant_a_id = (select auth.uid()) then c.last_read_a_at
        else c.last_read_b_at
      end as last_read
    from public.conversations c
    where c.id = any (p_conversation_ids)
      and (
        c.participant_a_id = (select auth.uid())
        or c.participant_b_id = (select auth.uid())
      )
  ),
  last_msg as (
    -- Dernier message NON supprimé par conversation (1 ligne/conv).
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.sender_id,
      m.type,
      m.body,
      m.file_name,
      m.created_at
    from public.messages m
    join mine on mine.id = m.conversation_id
    where m.deleted = false
    order by m.conversation_id, m.created_at desc
  ),
  unread_counts as (
    -- Messages reçus (sender ≠ caller) postérieurs à son last_read.
    select m.conversation_id, count(*)::int as cnt
    from public.messages m
    join mine on mine.id = m.conversation_id
    where m.sender_id <> mine.me
      and m.created_at > mine.last_read
    group by m.conversation_id
  )
  select
    mine.id,
    lm.sender_id,
    lm.type,
    lm.body,
    lm.file_name,
    lm.created_at,
    coalesce(uc.cnt, 0)
  from mine
  left join last_msg lm on lm.conversation_id = mine.id
  left join unread_counts uc on uc.conversation_id = mine.id;
$$;

comment on function public.community_conversation_summaries(uuid[]) is
  'Résumé par conversation (dernier message non supprimé + unreadCount du caller) '
  'pour la sidebar DM. Borné par p_conversation_ids (≤ 100). Remplace le chargement '
  'O(total messages) de listConversations. SECURITY INVOKER → RLS appliquée.';

-- Durcissement EXECUTE (style mig. 041) : retrait anon, octroi authenticated.
revoke execute on function public.community_conversation_summaries(uuid[]) from public;
grant  execute on function public.community_conversation_summaries(uuid[]) to authenticated;

commit;
