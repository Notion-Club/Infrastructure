-- Migration 010 — Brique 1 (settings) — username unique éditable
--
-- 1. Index unique case-insensitive sur username (en plus de la contrainte
--    UNIQUE existante qui est case-sensitive — "theo" et "THEO" cohabiteraient)
-- 2. Auto-génération d'un username au signup via handle_new_user
-- 3. Backfill des users existants qui ont username = null
--
-- ⚠️  Ticket Sensible — modifie le trigger handle_new_user (SECURITY DEFINER).
--     Lire ligne par ligne avant push.

-- ============================================================================
-- 1. Helper : génère un slug ASCII safe à partir d'une string libre
-- ============================================================================
-- Stratégie minimaliste, sans extension unaccent (qui n'est pas activée par
-- défaut sur Supabase) :
--   - lowercase
--   - garder uniquement a-z, 0-9, -, _
--   - tous les autres caractères (espaces, accents, ponctuation) → "-"
--   - collapse les "-" multiples + trim leading/trailing "-_"
--
-- Pour les accents fréquents en FR, on remplace explicitement avant le filter
-- pour préserver la lisibilité ("éric" → "eric" au lieu de "-ric").
create or replace function public.slugify_username(input text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_slug text;
begin
  if input is null then
    return null;
  end if;
  v_slug := lower(input);
  -- Remplacements accents FR courants
  v_slug := translate(v_slug,
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñç',
    'aaaaaaeeeeiiiiooooouuuuyync'
  );
  -- Tous les caractères non [a-z0-9_-] → '-'
  v_slug := regexp_replace(v_slug, '[^a-z0-9_-]+', '-', 'g');
  -- Collapse multiple '-'
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  -- Trim leading/trailing '-' ou '_'
  v_slug := regexp_replace(v_slug, '^[-_]+', '');
  v_slug := regexp_replace(v_slug, '[-_]+$', '');
  -- Vide après nettoyage = NULL pour que le caller fallback
  if length(v_slug) = 0 then
    return null;
  end if;
  return v_slug;
end;
$$;

comment on function public.slugify_username(text) is
  'Convertit une string libre (prénom, email, etc.) en username ASCII safe pour usage interne (auto-gen au signup, backfill).';

-- ============================================================================
-- 2. Helper : génère un username unique en concaténant un suffixe random
-- ============================================================================
-- Boucle jusqu'à 10 tentatives. Échoue (raise) si pas trouvé — extrêmement
-- improbable avec 4 chiffres random (10000 possibilités par base).
create or replace function public.generate_unique_username(base_slug text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_attempt int := 0;
begin
  v_base := coalesce(public.slugify_username(base_slug), 'user');
  -- Tronque à 24 chars pour laisser de la place au suffixe (max 30 chars total)
  v_base := left(v_base, 24);

  while v_attempt < 10 loop
    v_candidate := v_base || '-' || lpad(floor(random() * 10000)::text, 4, '0');
    if not exists (
      select 1 from public.profiles
      where lower(username) = lower(v_candidate)
    ) then
      return v_candidate;
    end if;
    v_attempt := v_attempt + 1;
  end loop;
  raise exception 'Impossible de générer un username unique pour base=%', base_slug;
end;
$$;

comment on function public.generate_unique_username(text) is
  'Génère un username unique du type "<base>-<4 random digits>". Utilisé par handle_new_user et le backfill.';

-- ============================================================================
-- 3. Backfill : tous les users existants avec username = null
-- ============================================================================
-- Fait AVANT de créer l'index unique case-insensitive (qui exigerait
-- un username partout) — mais en réalité la contrainte UNIQUE existante
-- accepte les NULL multiples. On backfill quand même pour cohérence.
do $$
declare
  rec record;
  v_base text;
  v_new_username text;
begin
  for rec in
    select id, first_name, full_name
    from public.profiles
    where username is null
      and deleted_at is null
  loop
    -- Base = first_name si dispo, sinon partie locale de l'email auth
    v_base := coalesce(
      rec.first_name,
      rec.full_name,
      (select split_part(email, '@', 1)
         from auth.users where id = rec.id)
    );
    v_new_username := public.generate_unique_username(v_base);
    update public.profiles set username = v_new_username where id = rec.id;
  end loop;
end;
$$;

-- ============================================================================
-- 4. Index unique case-insensitive
-- ============================================================================
-- La contrainte UNIQUE existante (cf. 002) est case-sensitive. On ajoute un
-- index unique sur lower(username) pour bloquer "theo" vs "THEO" vs "Theo".
-- Le NULL reste autorisé (deleted_at users post-anonymisation, edge cases).
create unique index if not exists profiles_username_lower_unique_idx
  on public.profiles (lower(username))
  where username is not null;

-- ============================================================================
-- 5. Update handle_new_user pour auto-générer un username
-- ============================================================================
-- Garde la logique full_name / first_name / last_name / display_name de la
-- migration 005, ajoute juste la génération du username.
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
  v_username_base text;
  v_username      text;
begin
  -- Résolution de l'organisation racine. En v0 codée en dur.
  select id into v_org_id
  from public.organizations
  where slug = 'notion-club';

  if v_org_id is null then
    raise exception 'Organisation racine introuvable (slug=notion-club). Lancer le seed.';
  end if;

  v_first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  v_last_name  := nullif(new.raw_user_meta_data->>'last_name', '');
  v_display_name := v_first_name;

  v_full_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(concat_ws(' ', v_first_name, v_last_name)), ''),
    split_part(new.email, '@', 1)
  );

  -- Génère un username unique. Base = first_name si dispo, sinon
  -- partie locale de l'email.
  v_username_base := coalesce(v_first_name, split_part(new.email, '@', 1));
  v_username := public.generate_unique_username(v_username_base);

  insert into public.profiles (
    id, organization_id,
    full_name, first_name, last_name, display_name, username
  )
  values (
    new.id, v_org_id,
    v_full_name, v_first_name, v_last_name, v_display_name, v_username
  );

  return new;
end;
$$;
