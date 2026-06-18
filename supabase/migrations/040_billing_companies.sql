-- 039_billing_companies.sql
-- OPS-129 — Informations de facturation + table Entreprises.
--
-- Objectif : permettre à un membre d'éditer ses informations de facturation.
-- S'il facture en tant qu'entreprise, les champs société (raison sociale,
-- SIRET, TVA, adresse société) NE doivent PAS être stockés sur le contact :
-- ils vivent dans une table dédiée `public.companies`, reliée aux utilisateurs
-- via `profiles.billing_company_id`. Une même entreprise peut être liée à
-- plusieurs membres (dédup par (organization_id, siret)).
--
-- Écritures : uniquement via la RPC `public.save_billing_details` (SECURITY
-- DEFINER, atomique, scope strict auth.uid()). RLS en lecture seule.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Table companies
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  -- dénormalisé (comme memberships) pour permettre une policy RLS admin sans
  -- jointure récursive.
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  siret           text,                       -- 14 chiffres (FR) ; null si étranger / non renseigné
  vat_number      text,                        -- TVA intracommunautaire ; null possible
  address_line1   text,
  address_line2   text,
  postal_code     text,
  city            text,
  country         text not null default 'FR',  -- ISO 3166-1 alpha-2
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.companies is
  'Fiches entreprises de facturation (OPS-129). Une entreprise peut être liée à plusieurs membres via profiles.billing_company_id. SIRET/TVA jamais stockés sur le contact.';

-- Dédup / partage : une seule fiche par SIRET au sein d'une organisation.
create unique index if not exists companies_org_siret_key
  on public.companies (organization_id, siret)
  where siret is not null;

create index if not exists companies_org_idx
  on public.companies (organization_id);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Colonnes de facturation sur profiles
--    (adresse de facturation INDIVIDUELLE + type + lien entreprise)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists billing_type text not null default 'individual'
    check (billing_type in ('individual', 'company'));

alter table public.profiles
  add column if not exists billing_company_id uuid
    references public.companies(id) on delete set null;

alter table public.profiles add column if not exists billing_name          text;
alter table public.profiles add column if not exists billing_address_line1 text;
alter table public.profiles add column if not exists billing_address_line2 text;
alter table public.profiles add column if not exists billing_postal_code   text;
alter table public.profiles add column if not exists billing_city          text;
alter table public.profiles add column if not exists billing_country       text;

create index if not exists profiles_billing_company_idx
  on public.profiles (billing_company_id)
  where billing_company_id is not null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. RLS (lecture seule — toutes les écritures passent par la RPC)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.companies enable row level security;

-- Helper : id de l'entreprise liée à l'utilisateur courant. SECURITY DEFINER +
-- search_path='' pour éviter la récursion RLS via profiles (pattern existant
-- current_profile_org / current_profile_admin_org).
create or replace function public.current_billing_company_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select billing_company_id
  from public.profiles
  where id = (select auth.uid());
$$;

comment on function public.current_billing_company_id() is
  'Retourne profiles.billing_company_id de l''utilisateur courant. Bypass RLS pour éviter la récursion dans les policies de companies.';

-- Le membre voit la fiche à laquelle il est rattaché.
drop policy if exists companies_select_linked on public.companies;
create policy companies_select_linked on public.companies
  for select
  to authenticated
  using (id = public.current_billing_company_id());

-- Les admins/super_admins voient les fiches de leur organisation (facturation /
-- reporting). Réutilise le helper existant.
drop policy if exists companies_select_admin on public.companies;
create policy companies_select_admin on public.companies
  for select
  to authenticated
  using (organization_id = public.current_profile_admin_org());

-- Aucune policy insert/update/delete : tout passe par save_billing_details.

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RPC d'enregistrement atomique
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.save_billing_details(
  p_billing_type   text,
  p_billing_name   text,
  p_address_line1  text,
  p_address_line2  text,
  p_postal_code    text,
  p_city           text,
  p_country        text,
  p_company_name   text,
  p_siret          text,
  p_vat_number     text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_org        uuid;
  v_company_id uuid;
  v_siret      text := nullif(regexp_replace(coalesce(p_siret, ''), '\D', '', 'g'), '');
  v_country    text := coalesce(nullif(btrim(coalesce(p_country, '')), ''), 'FR');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select organization_id into v_org
  from public.profiles
  where id = v_uid;

  if v_org is null then
    raise exception 'no_profile';
  end if;

  if p_billing_type = 'company' then
    if coalesce(btrim(p_company_name), '') = '' then
      raise exception 'company_name_required';
    end if;

    -- 1) Fiche existante avec le même SIRET dans l'orga → on s'y rattache.
    if v_siret is not null then
      select id into v_company_id
      from public.companies
      where organization_id = v_org and siret = v_siret;
    end if;

    -- 2) Sinon, réutilise la fiche déjà liée à l'utilisateur (renommage / sans SIRET).
    if v_company_id is null then
      select billing_company_id into v_company_id
      from public.profiles
      where id = v_uid;
    end if;

    -- 3) Sinon, création.
    if v_company_id is null then
      insert into public.companies (
        organization_id, name, siret, vat_number,
        address_line1, address_line2, postal_code, city, country, created_by
      ) values (
        v_org, btrim(p_company_name), v_siret, nullif(btrim(coalesce(p_vat_number, '')), ''),
        p_address_line1, p_address_line2, p_postal_code, p_city, v_country, v_uid
      )
      returning id into v_company_id;
    else
      update public.companies set
        name          = btrim(p_company_name),
        siret         = v_siret,
        vat_number    = nullif(btrim(coalesce(p_vat_number, '')), ''),
        address_line1 = p_address_line1,
        address_line2 = p_address_line2,
        postal_code   = p_postal_code,
        city          = p_city,
        country       = v_country
      where id = v_company_id
        and organization_id = v_org;
    end if;

    update public.profiles set
      billing_type       = 'company',
      billing_company_id = v_company_id
    where id = v_uid;

    return v_company_id;
  else
    -- Facturation individuelle : adresse stockée sur le profil, lien entreprise levé.
    update public.profiles set
      billing_type          = 'individual',
      billing_company_id    = null,
      billing_name          = nullif(btrim(coalesce(p_billing_name, '')), ''),
      billing_address_line1 = p_address_line1,
      billing_address_line2 = p_address_line2,
      billing_postal_code   = p_postal_code,
      billing_city          = p_city,
      billing_country       = v_country
    where id = v_uid;

    return null;
  end if;
end;
$$;

comment on function public.save_billing_details(text, text, text, text, text, text, text, text, text, text) is
  'Enregistre les informations de facturation de l''utilisateur courant de façon atomique (OPS-129). En mode entreprise : upsert de la fiche companies (dédup par (org, siret)) + lien profiles.billing_company_id. En mode individuel : adresse sur le profil + lien levé.';

revoke all on function public.save_billing_details(text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.save_billing_details(text, text, text, text, text, text, text, text, text, text) to authenticated;
