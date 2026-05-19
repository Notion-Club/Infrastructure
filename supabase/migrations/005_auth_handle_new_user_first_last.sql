-- Migration 005 — Brique 1 (auth)
-- Met à jour le trigger `handle_new_user` pour propager first_name, last_name,
-- display_name (colonnes ajoutées par la migration 004) et full_name à partir
-- des metadata passés au signup côté client.
--
-- ⚠️  Ticket Sensible — relire ligne par ligne avant `supabase db push`.
--     Le trigger tourne en SECURITY DEFINER : modifier sa logique impacte
--     tous les futurs INSERT sur auth.users.
--
-- Contrat metadata côté client (cf. signUpAction):
--   raw_user_meta_data.first_name : prénom (obligatoire à partir d'OPS-15)
--   raw_user_meta_data.last_name  : nom (obligatoire à partir d'OPS-15)
--   raw_user_meta_data.full_name  : déjà concaténé côté client (fallback)
--
-- Stratégie de remplissage :
--   - first_name        = metadata.first_name (peut être NULL si signup legacy)
--   - last_name         = metadata.last_name  (peut être NULL si signup legacy)
--   - display_name      = metadata.first_name (UI par défaut, customisable /settings)
--   - full_name (NOT NULL legacy) :
--       1. metadata.full_name si fourni (priorité au client)
--       2. sinon "first_name last_name" si les deux présents
--       3. sinon partie locale de l'email (fallback historique)
--
-- Compatibilité ascendante : tout user créé par un client qui ne pousse
-- pas first_name/last_name (ex: signup Google OAuth, anciens flows)
-- continue de fonctionner — full_name est toujours rempli.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id        uuid;
  v_first_name    text;
  v_last_name     text;
  v_display_name  text;
  v_full_name     text;
begin
  -- Résolution de l'organisation racine. En v0 codée en dur.
  select id into v_org_id
  from public.organizations
  where slug = 'notion-club';

  if v_org_id is null then
    raise exception 'Organisation racine introuvable (slug=notion-club). Lancer le seed.';
  end if;

  -- Récupération des champs depuis les metadata (peuvent être NULL si absents).
  v_first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  v_last_name  := nullif(new.raw_user_meta_data->>'last_name', '');

  -- display_name = first_name par défaut. NULL acceptable (colonne nullable).
  v_display_name := v_first_name;

  -- full_name (NOT NULL) — chaîne de fallbacks :
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(concat_ws(' ', v_first_name, v_last_name)), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (
    id, organization_id,
    full_name, first_name, last_name, display_name
  )
  values (
    new.id, v_org_id,
    v_full_name, v_first_name, v_last_name, v_display_name
  );

  return new;
end;
$$;

-- Le trigger lui-même n'a pas besoin d'être recréé (on_auth_user_created
-- existe déjà depuis 002, et `create or replace function` met à jour le
-- corps de la fonction qu'il exécute).
