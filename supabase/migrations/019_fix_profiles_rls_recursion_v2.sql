-- Migration 019 — Hotfix RLS profiles (régression introduite par 013)
--
-- 🔴 Sensible — restore le fix de la migration 007.
--
-- Problème :
--   La migration 013 (role alignment) a re-créé les policies
--   profiles_select_admin et profiles_update_admin avec un check inline :
--     using ( exists (select 1 from public.profiles admin where admin.role = 'admin' ...) )
--   → réintroduit la récursion infinie corrigée par 007.
--
-- Symptôme : "infinite recursion detected in policy for relation profiles"
-- dès qu'un Server Action fait .from("profiles").select() côté user.
--
-- Fix :
--   Restore l'usage de current_profile_admin_org() (helper SECURITY DEFINER
--   défini par migration 007) qui bypass RLS pour lire le role.

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select to authenticated
  using (
    organization_id = public.current_profile_admin_org()
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update to authenticated
  using (
    organization_id = public.current_profile_admin_org()
  )
  with check (
    organization_id = public.current_profile_admin_org()
  );
