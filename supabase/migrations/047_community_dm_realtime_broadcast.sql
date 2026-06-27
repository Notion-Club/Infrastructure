-- Migration 047 — Brique Community — DM temps réel via Broadcast from Database
--
-- Date    : 2026-06-27
-- Auteur  : Notion Club Infra
-- Module  : community (DM 1-1)
--
-- Pitch
-- -----
-- JUSQU'ICI (mig. 039) le DM temps réel reposait sur postgres_changes : chaque
-- client s'abonnait à TOUTE la table public.messages, le filtrage se faisant par
-- RLS côté serveur Realtime. Fan-out O(users connectés) par message — le mode
-- d'échec connu de postgres_changes à l'échelle.
--
-- On bascule sur le pattern recommandé par Supabase : Broadcast from Database.
-- Un trigger diffuse chaque message sur un canal PRIVÉ propre à sa conversation
-- (topic `conv:<conversation_id>`). Chaque client ne s'abonne qu'aux canaux de
-- SES conversations → fan-out O(participants) = 2.
--
-- Découverte des nouvelles conversations
-- --------------------------------------
-- Conséquence du modèle par-conversation : un user n'est pas abonné au canal
-- d'une conversation qui n'existe pas encore dans sa liste. Pour qu'un premier
-- message d'un inconnu apparaisse en live, un second trigger diffuse la création
-- d'une conversation sur le canal privé `dm-user:<participant_id>` de CHAQUE
-- participant — le client y est abonné en permanence et charge alors la nouvelle
-- conversation.
--
-- Sécurité (Realtime Authorization)
-- ---------------------------------
-- Les canaux privés exigent des policies RLS sur realtime.messages (évaluées au
-- JOIN). On autorise la réception sur `conv:<id>` aux seuls participants de la
-- conversation, et sur `dm-user:<id>` au seul user dont c'est le topic.
-- realtime.topic() donne le topic ; extension='broadcast' restreint au broadcast.
--
-- Réversibilité / coexistence
-- ---------------------------
-- 100 % additif. On NE retire PAS messages de la publication supabase_realtime
-- (mig. 039) : un client encore sur l'ancien chemin continuerait de fonctionner.
-- Le nettoyage de la publication se fera dans une migration ultérieure, une fois
-- le broadcast validé en conditions réelles (2 sessions).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Diffusion d'un message sur le canal privé de sa conversation
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_dm_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'conv:' || new.conversation_id::text,  -- topic (canal privé par conversation)
    tg_op,                                 -- event  ('INSERT')
    tg_op,                                 -- operation
    tg_table_name,                         -- 'messages'
    tg_table_schema,                       -- 'public'
    new,                                   -- record après changement
    old                                    -- record avant (null en INSERT)
  );
  return null;
end;
$$;

comment on function public.broadcast_dm_message() is
  'Trigger : diffuse chaque message inséré sur le canal privé conv:<conversation_id> '
  '(Broadcast from Database, remplace postgres_changes table-wide de la mig. 039).';

drop trigger if exists messages_broadcast_aii on public.messages;
create trigger messages_broadcast_aii
  after insert on public.messages
  for each row execute function public.broadcast_dm_message();

-- ---------------------------------------------------------------------------
-- 2. Diffusion de la création d'une conversation à chaque participant
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_dm_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Canal privé propre à chaque participant : il y est abonné en permanence et
  -- charge la nouvelle conversation à réception (event 'new_conversation').
  perform realtime.send(
    jsonb_build_object('conversation_id', new.id),
    'new_conversation',
    'dm-user:' || new.participant_a_id::text,
    true  -- private
  );
  perform realtime.send(
    jsonb_build_object('conversation_id', new.id),
    'new_conversation',
    'dm-user:' || new.participant_b_id::text,
    true  -- private
  );
  return null;
end;
$$;

comment on function public.broadcast_dm_conversation() is
  'Trigger : diffuse la création d''une conversation sur dm-user:<participant_id> '
  'de chaque participant, pour la découverte temps réel des nouvelles conversations.';

drop trigger if exists conversations_broadcast_aii on public.conversations;
create trigger conversations_broadcast_aii
  after insert on public.conversations
  for each row execute function public.broadcast_dm_conversation();

-- Triggers : pas d'appel RPC légitime → retrait EXECUTE (style mig. 041).
revoke execute on function public.broadcast_dm_message()      from anon, authenticated;
revoke execute on function public.broadcast_dm_conversation() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Realtime Authorization — policies RLS sur realtime.messages
-- ---------------------------------------------------------------------------
-- Réception autorisée sur conv:<uuid> aux seuls participants de la conversation.
drop policy if exists dm_participants_receive_conv_broadcast on realtime.messages;
create policy dm_participants_receive_conv_broadcast
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) ~ '^conv:[0-9a-fA-F-]{36}$'
  and exists (
    select 1
    from public.conversations c
    where c.id = split_part((select realtime.topic()), ':', 2)::uuid
      and (
        c.participant_a_id = (select auth.uid())
        or c.participant_b_id = (select auth.uid())
      )
  )
);

-- Réception autorisée sur dm-user:<uuid> au seul user dont c'est le topic.
drop policy if exists dm_user_receive_own_topic on realtime.messages;
create policy dm_user_receive_own_topic
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) ~ '^dm-user:[0-9a-fA-F-]{36}$'
  and split_part((select realtime.topic()), ':', 2)::uuid = (select auth.uid())
);

commit;
