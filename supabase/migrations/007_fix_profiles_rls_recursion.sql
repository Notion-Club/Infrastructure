-- Migration 007 — Brique 1 (auth) — fix critique RLS
-- Corrige la récursion infinie sur les policies `profiles_select_admin` et
-- `profiles_update_admin` introduites par la migration 002.
--
-- 🔴 Sensible — modifie la RLS de profiles.
--
-- Problème :
--   La policy SELECT pour admins fait :
--     using ( exists (select 1 from profiles admin where admin.id = auth.uid()
--                       and admin.role in ('admin','super_admin') and …) )
--   Or `select … from profiles` re-déclenche la policy, qui re-fait le select,
--   etc. → "infinite recursion detected in policy for relation profiles".
--
--   Impact en l'état : tout SELECT user-context sur profiles renvoie
--   l'erreur Postgres 42P17. Le trigger handle_new_user n'est pas affecté
--   car SECURITY DEFINER, mais toute lecture côté app (banner, settings,
--   etc.) est cassée.
--
-- Fix :
--   Extraire la lecture du role dans une fonction SECURITY DEFINER qui
--   bypass RLS (pattern recommandé Supabase). La policy appelle cette
--   fonction au lieu de re-querier `profiles`.

-- ============================================================================
-- 1. Helper SECURITY DEFINER : retourne le role + org_id de l'user courant
-- ============================================================================
-- SECURITY DEFINER avec search_path vide pour les mêmes raisons que
-- handle_new_user (protection hijack). Retourne NULL si l'user n'a pas
-- de profile (cas légitime juste avant le trigger).
create or replace function public.current_profile_admin_org()
returns uuid
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id
  from public.profiles
  where id = (select auth.uid())
    and role in ('admin', 'super_admin');
  return v_org_id;
end;
$$;

comment on function public.current_profile_admin_org() is
  'Retourne organization_id si l''user courant est admin/super_admin de son org, NULL sinon. Bypass RLS pour éviter la récursion dans les policies de profiles.';

-- ============================================================================
-- 2. Recréation de la policy SELECT admin sans récursion
-- ============================================================================
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select to authenticated
  using (
    organization_id = public.current_profile_admin_org()
  );

-- ============================================================================
-- 3. Recréation de la policy UPDATE admin sans récursion
-- ============================================================================
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update to authenticated
  using (
    organization_id = public.current_profile_admin_org()
  );

-- ============================================================================
-- 4. Recréation de profiles_update_self sans récursion
-- ============================================================================
-- Cette policy lit le profile actuel pour comparer role/is_banned/org dans
-- WITH CHECK. Mêmes raisons : SELECT sur profiles ré-applique la RLS.
-- On extrait via une fonction SECURITY DEFINER qui renvoie le snapshot
-- des champs verrouillés.
create or replace function public.current_profile_locked_fields()
returns table (
  v_role            text,
  v_is_banned       boolean,
  v_organization_id uuid
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  return query
  select p.role, p.is_banned, p.organization_id
  from public.profiles p
  where p.id = (select auth.uid());
end;
$$;

comment on function public.current_profile_locked_fields() is
  'Retourne role/is_banned/organization_id du profile courant. Utilisé par profiles_update_self WITH CHECK pour interdire la modification de ces champs sensibles, sans récursion RLS.';

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and exists (
      select 1
      from public.current_profile_locked_fields() lf
      where lf.v_role = public.profiles.role
        and lf.v_is_banned = public.profiles.is_banned
        and lf.v_organization_id = public.profiles.organization_id
    )
  );

-- ============================================================================
-- 5. Note sur profiles_select_self
-- ============================================================================
-- Cette policy n'a pas ce problème : `using (id = (select auth.uid()))`
-- ne re-query pas profiles. Elle reste inchangée.
