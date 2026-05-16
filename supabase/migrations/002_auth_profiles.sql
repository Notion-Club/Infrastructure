-- Migration 002 — Brique 1 (auth)
-- Table `profiles` : extension métier 1-1 de auth.users.
-- Trigger `handle_new_user` : crée automatiquement la ligne profile
-- à chaque création d'un user dans auth.users.
--
-- ⚠️  Ticket Sensible — relire ligne par ligne avant `supabase db push`.
--     Points critiques :
--       (a) La fonction trigger est SECURITY DEFINER : elle s'exécute
--           avec les privilèges du owner (postgres), donc bypass RLS sur
--           public.profiles. C'est nécessaire pour INSERT depuis un
--           trigger sur auth.users.
--       (b) RLS empêche un user de modifier `role`, `is_banned`,
--           `organization_id` sur son propre profile.
--       (c) Les admins de l'org peuvent SELECT/UPDATE tous les profiles
--           de leur org (clause d'isolation : same organization_id).

-- ============================================================================
-- 1. Table profiles
-- ============================================================================
create table if not exists public.profiles (
  -- Lien 1-1 avec auth.users — même UUID, cascade à la suppression du user.
  id                    uuid primary key
                        references auth.users(id) on delete cascade,

  -- Tenant. En v0 toujours l'org `notion-club` (résolu dans le trigger).
  organization_id       uuid not null references public.organizations(id),

  -- Identité affichée
  full_name             text not null,
  username              text unique,
  avatar_url            text,
  bio                   text,
  phone                 text,

  -- Canaux de comm (séparés volontairement du email de auth.users)
  communication_email   text,
  notion_email          text,

  -- Activité
  last_login_at         timestamptz,
  last_active_at        timestamptz,

  -- Autorisations grossières (les vraies permissions vivent dans memberships)
  role                  text not null default 'member'
                        check (role in ('member', 'moderator', 'admin', 'super_admin')),
  is_banned             boolean not null default false,

  -- Confirmation email (séparée de auth.users.email_confirmed_at pour
  -- garder le contrôle métier — workflow B non-bloquant)
  email_verified_at     timestamptz,

  -- Lien vers la page Notion correspondante (sync brique 4)
  notion_member_page_id text unique,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.profiles is
  'Profil métier 1-1 de auth.users. Créé automatiquement par le trigger handle_new_user.';

create index if not exists profiles_organization_id_idx
  on public.profiles (organization_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. Trigger handle_new_user : auth.users INSERT → profiles INSERT
-- ============================================================================
-- SECURITY DEFINER : la fonction tourne avec les droits du owner
-- (généralement `postgres`), pas avec ceux de l'appelant. Indispensable
-- car le contexte d'exécution d'un trigger sur auth.users est limité.
-- `set search_path = ''` : protection contre les attaques par hijack
-- de search_path (best practice Supabase).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id        uuid;
  v_full_name     text;
begin
  -- Résolution de l'organisation racine. En v0 codée en dur.
  -- À l'avenir : pourra dépendre d'un metadata `org_slug` passé au signup.
  select id into v_org_id
  from public.organizations
  where slug = 'notion-club';

  if v_org_id is null then
    raise exception 'Organisation racine introuvable (slug=notion-club). Lancer le seed.';
  end if;

  -- Source du full_name, par ordre de préférence :
  --   1. raw_user_meta_data->>'full_name' (renseigné par le client au signup)
  --   2. partie locale de l'email (avant @)
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, organization_id, full_name)
  values (new.id, v_org_id, v_full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 3. RLS
-- ============================================================================
alter table public.profiles enable row level security;

-- ── SELECT ────────────────────────────────────────────────────────────────
-- User : voit son propre profile.
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Admin de l'org : voit tous les profiles de la même org.
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.profiles admin
      where admin.id = (select auth.uid())
        and admin.role in ('admin', 'super_admin')
        and admin.organization_id = public.profiles.organization_id
    )
  );

-- ── UPDATE ────────────────────────────────────────────────────────────────
-- User : update son propre profile MAIS interdiction de toucher aux champs
-- sensibles (role, is_banned, organization_id, id). Le contrôle se fait
-- via WITH CHECK : la nouvelle ligne doit préserver les valeurs existantes
-- pour ces colonnes.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select role from public.profiles where id = (select auth.uid()))
    and is_banned = (select is_banned from public.profiles where id = (select auth.uid()))
    and organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  );

-- Admin de l'org : peut UPDATE tous les profiles de son org (y compris
-- role et is_banned, indispensable pour modérer).
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update to authenticated
  using (
    exists (
      select 1 from public.profiles admin
      where admin.id = (select auth.uid())
        and admin.role in ('admin', 'super_admin')
        and admin.organization_id = public.profiles.organization_id
    )
  );

-- Pas de policy INSERT côté user : la création passe exclusivement par le
-- trigger handle_new_user (SECURITY DEFINER, bypass RLS).
-- Pas de policy DELETE : la suppression cascade depuis auth.users.
