-- Migration 013 — Brique 2 (community) — pré-requis transverses
-- Aligne les rôles côté DB sur le modèle utilisé par le module community
-- (member / mentor / admin) et ajoute la capability `can_view_paid_content`
-- nécessaire à la RLS de visibilité des posts paid_only.
--
-- ⚠️  Ticket Sensible — touche au système d'autorisation (cf. migration 003).
--     Toute capability ajoutée ici DOIT être ajoutée dans la whitelist de
--     user_has_capability(). Sinon RLS qui dépendent de la capability seront
--     en false par défaut.

-- ============================================================================
-- 1. Alignement profiles.role : ('member','moderator','admin','super_admin')
--    → ('member','mentor','admin')
-- ============================================================================
-- Stratégie :
--   1. Backfill des anciennes valeurs vers les nouvelles :
--      'moderator' → 'admin' (faute de mieux, c'était l'intention modération)
--      'super_admin' → 'admin' (on dégrade à admin standard, pas de notion
--                                de super-admin dans le nouveau modèle)
--   2. Drop l'ancien check, add le nouveau.
--   Pas de DEFAULT à changer, 'member' reste la valeur par défaut.

update public.profiles
   set role = 'admin'
 where role in ('moderator', 'super_admin');

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member', 'mentor', 'admin'));

comment on column public.profiles.role is
  'Rôle plateforme : member (défaut) | mentor (anim live, médiation) | admin (modération, settings org). Source de vérité pour visibility-rules et dm-rules.';

-- ============================================================================
-- 2. Mise à jour des RLS profiles qui référençaient les anciens rôles
-- ============================================================================
-- Les policies profiles_select_admin et profiles_update_admin (migration 002)
-- check `admin.role in ('admin', 'super_admin')`. Après cette migration,
-- 'super_admin' n'existe plus → le check devient `admin.role = 'admin'`.
-- On recrée les policies pour rester explicite (drop+create idempotent).

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.profiles admin
      where admin.id = (select auth.uid())
        and admin.role = 'admin'
        and admin.organization_id = public.profiles.organization_id
    )
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update to authenticated
  using (
    exists (
      select 1 from public.profiles admin
      where admin.id = (select auth.uid())
        and admin.role = 'admin'
        and admin.organization_id = public.profiles.organization_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles admin
      where admin.id = (select auth.uid())
        and admin.role = 'admin'
        and admin.organization_id = public.profiles.organization_id
    )
  );

-- ============================================================================
-- 3. Nouvelle capability : can_view_paid_content
-- ============================================================================
-- Permet aux RLS des posts/comments/messages de filtrer le contenu paid_only
-- en se basant sur les offres actives de l'user (pas sur un check role).
--
-- Sémantique : TRUE = ce user peut voir le contenu marqué paid_only dans le
-- feed communauté. Indépendant de can_view_community (un user peut accéder
-- au feed sans avoir débloqué le paid_only, ex: offre challenge gratuite).

alter table public.offers
  add column if not exists can_view_paid_content boolean not null default false;

comment on column public.offers.can_view_paid_content is
  'Si TRUE, les memberships actifs sur cette offre permettent de voir les posts/comments/messages marqués audience=paid_only.';

-- ============================================================================
-- 4. Whitelist user_has_capability : ajout de la nouvelle capability
-- ============================================================================
-- La fonction est SECURITY DEFINER avec un check explicite contre une
-- whitelist hardcodée (anti-injection via format(%I)). On la recrée pour
-- inclure 'can_view_paid_content'. Toute autre logique reste identique.

create or replace function public.user_has_capability(
  p_profile_id uuid,
  p_capability text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result boolean;
begin
  if p_capability not in (
    'can_access_challenge_program',
    'can_access_paid_programs',
    'can_message_admins',
    'can_view_community',
    'can_view_paid_content',
    'can_book_calls',
    'can_view_call_summaries',
    'can_access_templates_library'
  ) then
    raise exception 'Capability inconnue: %', p_capability
      using errcode = 'invalid_parameter_value';
  end if;

  execute format($q$
    select exists (
      select 1
      from public.memberships m
      join public.offers o on o.id = m.offer_id
      where m.profile_id = $1
        and m.status = 'active'
        and (m.expires_at is null or m.expires_at > now())
        and o.is_active = true
        and o.%I = true
    )
  $q$, p_capability)
  into v_result
  using p_profile_id;

  return coalesce(v_result, false);
end;
$$;

comment on function public.user_has_capability(uuid, text) is
  'Retourne TRUE si le user a au moins une membership active dont l''offre porte la capability. Whitelist anti-injection. Migration 013 : ajout can_view_paid_content.';
