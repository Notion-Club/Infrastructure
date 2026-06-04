-- Migration 032 — RPC get_user_capabilities
--
-- Récupère TOUTES les capabilities d'un user en UNE seule requête JOIN, plutôt
-- que 8 appels successifs à user_has_capability(). Utilisé par
-- ProfileIdentityProvider (layout (app)) pour hydrater le contexte avec
-- l'ensemble des droits du user, et exposé via une RPC pour les modules qui
-- ont besoin d'un check précis sans passer par RLS (ex: server-side gating
-- du content des ressources payantes).
--
-- Retourne un jsonb avec les 8 capabilities en booléen (true si l'user a AU
-- MOINS UNE membership active avec une offre portant cette capability).
--
-- Sécurité :
--   - SECURITY DEFINER + search_path = '' : isole le contexte d'exécution.
--   - Vérifie p_user_id = auth.uid() OR appelant admin : sinon raise exception.
--     Empêche un user A de querier les capabilities du user B.

create or replace function public.get_user_capabilities(
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_target uuid;
  v_role text;
  v_result jsonb;
begin
  -- Default = appelant courant.
  v_target := coalesce(p_user_id, (select auth.uid()));

  if v_target is null then
    raise exception 'Non authentifié' using errcode = 'insufficient_privilege';
  end if;

  -- Si on demande les caps d'un autre user, il faut être admin.
  if v_target <> (select auth.uid()) then
    select role into v_role
    from public.profiles
    where id = (select auth.uid());

    if v_role is null or v_role <> 'admin' then
      raise exception 'Non autorisé' using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Une seule passe sur memberships → offers, agrégation booléenne par OR.
  -- COALESCE garantit que les users sans membership active reçoivent
  -- {can_x: false, ...} plutôt que null.
  select jsonb_build_object(
    'can_access_challenge_program', coalesce(bool_or(o.can_access_challenge_program), false),
    'can_access_paid_programs',     coalesce(bool_or(o.can_access_paid_programs),     false),
    'can_message_admins',           coalesce(bool_or(o.can_message_admins),           false),
    'can_view_community',           coalesce(bool_or(o.can_view_community),           false),
    'can_view_paid_content',        coalesce(bool_or(o.can_view_paid_content),        false),
    'can_book_calls',               coalesce(bool_or(o.can_book_calls),               false),
    'can_view_call_summaries',      coalesce(bool_or(o.can_view_call_summaries),      false),
    'can_access_templates_library', coalesce(bool_or(o.can_access_templates_library), false)
  )
  into v_result
  from public.memberships m
  join public.offers o on o.id = m.offer_id
  where m.profile_id = v_target
    and m.status = 'active'
    and (m.expires_at is null or m.expires_at > now())
    and o.is_active = true;

  -- Si aucun row matché, COALESCE de bool_or() retourne null donc on rebascule
  -- sur un objet "tout false".
  if v_result is null then
    v_result := jsonb_build_object(
      'can_access_challenge_program', false,
      'can_access_paid_programs',     false,
      'can_message_admins',           false,
      'can_view_community',           false,
      'can_view_paid_content',        false,
      'can_book_calls',               false,
      'can_view_call_summaries',      false,
      'can_access_templates_library', false
    );
  end if;

  return v_result;
end;
$$;

comment on function public.get_user_capabilities(uuid) is
  'Retourne les 8 capabilities du user en jsonb (1 query au lieu de 8). Self ou admin uniquement.';

grant execute on function public.get_user_capabilities(uuid) to authenticated;
