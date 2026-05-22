-- Migration 012 — Brique 1 (settings) — channel global toggle
-- Introduit `channel_preferences` : un toggle global par canal (email / in_app
-- / whatsapp) qui complète la matrice fine `notification_preferences` (cf.
-- migration 004).
--
-- Sémantique :
--   - Une ligne = pour ce user, ce canal global est on/off
--   - Absence de ligne = défaut implicite (email + in_app ON, whatsapp OFF)
--   - Si un canal global est OFF, toutes les notifs de ce canal sont coupées,
--     peu importe l'état de la matrice fine (logique appliquée côté UI/worker)
--
-- Pourquoi une table dédiée plutôt qu'une colonne JSONB sur profiles ?
--   - Cohérent avec `notification_preferences` (même grain de RLS)
--   - Permet d'évoluer (ajouter de la metadata par canal : silence_until, etc.)
--     sans toucher la schema profiles
--   - Granularité de l'updated_at par canal (utile pour audit)

-- ============================================================================
-- 1. Table channel_preferences
-- ============================================================================
create table if not exists public.channel_preferences (
  user_id    uuid not null references auth.users(id) on delete cascade,
  channel    text not null
             check (channel in ('email', 'in_app', 'whatsapp')),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

comment on table public.channel_preferences is
  'Toggle global par canal de notification. Absence de ligne = défaut (email/in_app on, whatsapp off).';

drop trigger if exists channel_preferences_set_updated_at
  on public.channel_preferences;
create trigger channel_preferences_set_updated_at
  before update on public.channel_preferences
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. RLS — l'user gère ses propres canaux
-- ============================================================================
alter table public.channel_preferences enable row level security;

drop policy if exists channel_prefs_select_self on public.channel_preferences;
create policy channel_prefs_select_self
  on public.channel_preferences for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists channel_prefs_insert_self on public.channel_preferences;
create policy channel_prefs_insert_self
  on public.channel_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists channel_prefs_update_self on public.channel_preferences;
create policy channel_prefs_update_self
  on public.channel_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists channel_prefs_delete_self on public.channel_preferences;
create policy channel_prefs_delete_self
  on public.channel_preferences for delete to authenticated
  using (user_id = (select auth.uid()));
