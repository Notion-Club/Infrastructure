-- Seed exécuté après `supabase db reset` en local/preview.
-- Doit rester IDEMPOTENT : utilisable plusieurs fois sans casser.

-- ============================================================================
-- Organisation racine
-- ============================================================================
insert into public.organizations (slug, name)
values ('notion-club', 'Notion Club')
on conflict (slug) do nothing;

-- ============================================================================
-- Catalogue d'offres
-- ============================================================================
-- challenge-gratuit : programme d'amorçage, gratuit. Accès uniquement au
--                     programme Challenge (rien d'autre — pas de communauté,
--                     pas de calls, pas de templates).
insert into public.offers (
  slug, name, description,
  can_access_challenge_program, can_access_paid_programs,
  can_message_admins, can_view_community, can_book_calls,
  can_view_call_summaries, can_access_templates_library,
  is_paid, default_price_eur, default_duration_days, is_active
) values (
  'challenge-gratuit', 'Challenge Gratuit',
  'Programme d''amorçage gratuit. Accès au Challenge uniquement.',
  true,  false,
  false, false, false,
  false, false,
  false, null, null, true
) on conflict (slug) do nothing;

-- formation : accès à tous les programmes payants + challenge + messagerie
--             admins + librairie de templates. Pas de communauté/calls.
insert into public.offers (
  slug, name, description,
  can_access_challenge_program, can_access_paid_programs,
  can_message_admins, can_view_community, can_book_calls,
  can_view_call_summaries, can_access_templates_library,
  is_paid, default_price_eur, default_duration_days, is_active
) values (
  'formation', 'Formation',
  'Accès aux programmes payants, messagerie admins et bibliothèque de templates.',
  true,  true,
  true,  false, false,
  false, true,
  true,  null, null, true
) on conflict (slug) do nothing;

-- accompagnement : tout débloqué. Durée par défaut 120j.
insert into public.offers (
  slug, name, description,
  can_access_challenge_program, can_access_paid_programs,
  can_message_admins, can_view_community, can_book_calls,
  can_view_call_summaries, can_access_templates_library,
  is_paid, default_price_eur, default_duration_days, is_active
) values (
  'accompagnement', 'Accompagnement',
  'Offre complète : tous les programmes, communauté, calls coaching, templates.',
  true,  true,
  true,  true,  true,
  true,  true,
  true,  null, 120, true
) on conflict (slug) do nothing;
