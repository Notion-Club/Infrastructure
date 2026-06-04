-- ============================================================================
-- 032 — Fonction RPC pour calculer le résumé de N conversations en 1 passe (OPS-98)
-- ============================================================================
-- Contexte
-- --------
-- listConversations() (server/queries.ts) calcule pour chaque conv :
--   - le dernier message non-supprimé (pour preview + lastMessageType)
--   - le compteur de messages non-lus pour le viewer
--
-- Avant cette migration, le code faisait :
--   SELECT ... FROM messages WHERE conversation_id IN (...convIds)
-- Ce qui ramène TOUS les messages des 100 dernières convs (potentiellement
-- des milliers de lignes), pour ensuite filtrer en JS (Map last-by-conv).
--
-- Cette approche cause un délai notable au chargement (le ticket OPS-98
-- décrit le flash "Aucun message" avant que les previews finissent par
-- s'afficher). Sur des comptes avec beaucoup d'historique, la latence
-- atteint plusieurs centaines de ms.
--
-- Cette fonction RPC fait tout le travail en SQL avec :
--   - DISTINCT ON (conversation_id) ... ORDER BY conversation_id, created_at DESC
--     pour ne ramener QUE le dernier message non-supprimé de chaque conv
--   - Un LEFT JOIN avec un sous-COUNT pour le unread_count par conv
--
-- Tout est indexé sur (conversation_id, created_at DESC) — cf. mig. 014.
-- La fonction est SECURITY INVOKER : la RLS messages_select_participant
-- continue à filtrer correctement (le viewer ne voit que ses propres convs).
--
-- ⚠️ Pas d'impact sur les autres call sites : getConversation() utilise
-- toujours sa propre query (full history du thread ouvert).

create or replace function public.list_conversation_summaries(
  conv_ids uuid[],
  viewer_id uuid
)
returns table (
  conversation_id uuid,
  last_message_id uuid,
  last_message_type text,
  last_message_body text,
  last_message_file_name text,
  last_message_sender_id uuid,
  last_message_created_at timestamptz,
  unread_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with last_per_conv as (
    -- DISTINCT ON garantit qu'on ne récupère QUE la dernière ligne par
    -- conversation_id, en s'appuyant sur l'index (conversation_id, created_at DESC)
    -- créé en mig. 014. C'est l'équivalent SQL natif de Map.set(convId, msg)
    -- côté JS, mais exécuté côté DB → ~10× plus rapide.
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.id,
      m.type,
      m.body,
      m.file_name,
      m.sender_id,
      m.created_at
    from public.messages m
    where m.conversation_id = any(conv_ids)
      and m.deleted = false
    order by m.conversation_id, m.created_at desc
  ),
  unread as (
    -- Compteur non-lus : on join avec conversations pour récupérer le
    -- last_read_X_at du viewer puis on filtre les messages plus récents
    -- et pas envoyés par lui.
    select
      m.conversation_id,
      count(*)::int as unread_count
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = any(conv_ids)
      and m.deleted = false
      and m.sender_id <> viewer_id
      and m.created_at > case
        when c.participant_a_id = viewer_id then c.last_read_a_at
        else c.last_read_b_at
      end
    group by m.conversation_id
  )
  select
    l.conversation_id,
    l.id as last_message_id,
    l.type as last_message_type,
    l.body as last_message_body,
    l.file_name as last_message_file_name,
    l.sender_id as last_message_sender_id,
    l.created_at as last_message_created_at,
    coalesce(u.unread_count, 0) as unread_count
  from last_per_conv l
  left join unread u on u.conversation_id = l.conversation_id;
$$;

revoke all on function public.list_conversation_summaries(uuid[], uuid) from public;
grant execute on function public.list_conversation_summaries(uuid[], uuid) to authenticated;

comment on function public.list_conversation_summaries(uuid[], uuid) is
  'Retourne pour chaque conv (parmi conv_ids) le dernier message non-supprimé '
  'et le compteur de messages non-lus pour viewer_id. Utilisé par '
  'listConversations() pour générer la liste latérale en une seule query. '
  'SECURITY INVOKER : RLS messages_select_participant et conversations_select_participant '
  'restent appliquées, le viewer ne peut donc voir que ses propres convs.';
