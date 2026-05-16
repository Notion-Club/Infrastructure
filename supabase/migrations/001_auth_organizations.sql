-- Migration 001 — Brique 1 (auth)
-- Table `organizations` : socle multi-tenant.
-- Toutes les tables métier (profiles, memberships, etc.) auront un
-- `organization_id NOT NULL REFERENCES organizations(id)`.
-- En v0 une seule organisation : `notion-club` (créée via seed.sql).

-- ============================================================================
-- 1. Helper générique : trigger qui met à jour `updated_at` à chaque UPDATE
-- ============================================================================
-- Réutilisable par toutes les tables qui ont une colonne `updated_at`.
-- Pas besoin de la redéfinir dans les migrations suivantes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- 2. Table `organizations`
-- ============================================================================
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  logo_url      text,
  primary_color text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.organizations is
  'Tenants de la plateforme. En v0 : une seule ligne `notion-club`.';
comment on column public.organizations.slug is
  'Identifiant URL-friendly, unique (ex: ''notion-club'').';

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. RLS
-- ============================================================================
-- Lecture publique pour tout user authentifié (les orgs sont des entités
-- "publiques" côté plateforme — leur nom/logo peut s'afficher partout).
-- Écriture réservée au service_role (admin via dashboard / scripts).
alter table public.organizations enable row level security;

drop policy if exists organizations_select_authenticated on public.organizations;
create policy organizations_select_authenticated
  on public.organizations
  for select
  to authenticated
  using (true);

-- Pas de policy INSERT/UPDATE/DELETE pour le rôle `authenticated` :
-- en l'absence de policy, RLS refuse par défaut. Le service_role bypass RLS,
-- donc reste capable d'opérer.
