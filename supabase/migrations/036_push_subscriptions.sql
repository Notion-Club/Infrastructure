-- Migration 036 — Web Push subscriptions
--
-- Brique « PWA notifications » : table dédiée aux PushSubscription
-- générées par PushManager.subscribe() côté navigateur (iOS Safari ≥ 16.4
-- en standalone, Chrome, Firefox, etc.) + extension des canaux
-- notification existants pour intégrer le push.
--
-- Architecture :
--   1. Étendre les CHECK constraints de `notification_preferences` (004)
--      et `channel_preferences` (012) pour accepter le canal 'push' au
--      même niveau qu'email / in_app / whatsapp.
--   2. Créer `push_subscriptions` : un user peut avoir plusieurs souscriptions
--      (un endpoint = un device/navigateur), distinguées par leur `endpoint`
--      qui est l'URL push service unique.
--   3. RLS user-scoped — un user ne lit que ses propres souscriptions ;
--      seul le service_role (côté serveur, dans /api/push/send) peut faire
--      des reads cross-user pour envoyer les pushes.

-- ============================================================================
-- 1. Étendre les CHECK constraints pour autoriser 'push'
-- ============================================================================

-- notification_preferences.channel (migration 004)
alter table public.notification_preferences
  drop constraint if exists notification_preferences_channel_check;
alter table public.notification_preferences
  add constraint notification_preferences_channel_check
  check (channel in ('email', 'in_app', 'whatsapp', 'push'));

-- channel_preferences.channel (migration 012)
alter table public.channel_preferences
  drop constraint if exists channel_preferences_channel_check;
alter table public.channel_preferences
  add constraint channel_preferences_channel_check
  check (channel in ('email', 'in_app', 'whatsapp', 'push'));

-- ============================================================================
-- 2. Table push_subscriptions
-- ============================================================================
-- Un user peut avoir plusieurs entrées (un endpoint = un device/navigateur
-- où il a installé la PWA). On stocke les 3 champs nécessaires à la lib
-- `web-push` côté serveur pour chiffrer + envoyer la notif.
--
-- `expired_at` est positionné par /api/push/send quand le push service
-- renvoie un 404/410 : la souscription est invalide, on évite de la
-- ré-essayer mais on garde la ligne pour audit / re-sub à venir.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expired_at  timestamptz
);

comment on table public.push_subscriptions is
  'Web Push subscriptions par user — une ligne = un device/navigateur ayant accepté les notifications. expired_at non null = endpoint invalide remonté par le push service.';

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id)
  where expired_at is null;

create index if not exists push_subscriptions_endpoint_idx
  on public.push_subscriptions (endpoint);

-- ============================================================================
-- 3. RLS — l'user gère ses propres souscriptions
-- ============================================================================
-- Le service_role (utilisé dans /api/push/send) bypasse RLS donc peut
-- iterer sur toutes les souscriptions d'un userId — pas de policy
-- additionnelle à écrire pour ce cas.

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_self on public.push_subscriptions;
create policy push_subscriptions_select_self
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_insert_self on public.push_subscriptions;
create policy push_subscriptions_insert_self
  on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_update_self on public.push_subscriptions;
create policy push_subscriptions_update_self
  on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_delete_self on public.push_subscriptions;
create policy push_subscriptions_delete_self
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
