-- Migration 004 — Brique 1 (auth) + cross-cutting (settings)
-- Étend `profiles` avec les champs édités depuis /settings, et introduit
-- `notification_preferences` (matrice catégorie × canal × user).

-- ============================================================================
-- 1. Profiles : nouveaux champs édités depuis /settings
-- ============================================================================
-- Nullable + IF NOT EXISTS : permet de re-jouer la migration sans casser un
-- environnement où certaines colonnes auraient été créées manuellement.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists first_name   text,
  add column if not exists last_name    text;

comment on column public.profiles.display_name is
  'Nom d''affichage choisi par l''user, utilisé dans toute l''UI.';
comment on column public.profiles.first_name is
  'Prénom — utilisé pour la facturation.';
comment on column public.profiles.last_name is
  'Nom de famille — utilisé pour la facturation.';

-- ============================================================================
-- 2. notification_preferences : matrice catégorie × canal
-- ============================================================================
-- Une ligne = pour ce user, sur cette catégorie, ce canal est on/off.
-- Pas de ligne = défaut implicite (canal activé pour email/in_app, sms off).
create table if not exists public.notification_preferences (
  user_id    uuid not null references auth.users(id) on delete cascade,
  category   text not null
             check (category in (
               'new_modules',
               'formation_reminders',
               'coaching_calls',
               'community_messages',
               'billing'
             )),
  channel    text not null
             check (channel in ('email', 'in_app', 'sms')),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category, channel)
);

comment on table public.notification_preferences is
  'Préférences fines par user × catégorie × canal. Absence de ligne = défaut.';

drop trigger if exists notification_preferences_set_updated_at
  on public.notification_preferences;
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. RLS sur notification_preferences
-- ============================================================================
alter table public.notification_preferences enable row level security;

-- L'user gère ses propres préférences (SELECT / INSERT / UPDATE / DELETE).
drop policy if exists notif_prefs_select_self on public.notification_preferences;
create policy notif_prefs_select_self
  on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notif_prefs_insert_self on public.notification_preferences;
create policy notif_prefs_insert_self
  on public.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists notif_prefs_update_self on public.notification_preferences;
create policy notif_prefs_update_self
  on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists notif_prefs_delete_self on public.notification_preferences;
create policy notif_prefs_delete_self
  on public.notification_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================================
-- 4. Storage bucket `avatars` — upload depuis /settings
-- ============================================================================
-- Bucket public en lecture, écriture restreinte au owner via RLS sur
-- storage.objects. L'instruction ON CONFLICT permet de re-jouer la migration.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- RLS — un user écrit uniquement dans son dossier `<user_id>/...`.
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Lecture publique : tout le monde peut afficher un avatar (bucket public).
drop policy if exists avatars_select_public on storage.objects;
create policy avatars_select_public
  on storage.objects for select to public
  using (bucket_id = 'avatars');
