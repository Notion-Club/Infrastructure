-- Migration 031 — Brique 3 (ressources) — structure cache + accès
--
-- Modèle copié du pattern Formation (migration 016) :
--   A. Cache de structure (partagé, alimenté par /api/ressources/sync depuis Notion)
--        resources — UNIFIE resource ET template (catégorie en colonne)
--      → métadonnées + body (content jsonb pour les resources, urls Tella/Notion
--        pour les templates). Body lourd = column TOAST automatique.
--   B. Mapping d'accès (config) :
--        resources_access — relie une visibilité Notion à une capability Supabase.
--      → indépendant des lignes ressources (la visibilité est portée par chaque
--        ressource dans Notion, donc on mappe par valeur de visibilité, pas par
--        notion_id individuel — bien plus maintenable que formation_access).
--
-- ⚠️  La RLS de lecture repose sur user_has_capability() et le mapping
--     resources_access. L'écriture passe exclusivement par service_role (sync admin).

-- ============================================================================
-- A — resources (cache structure unifié)
-- ============================================================================
create table if not exists public.resources (
  id              uuid primary key default gen_random_uuid(),
  notion_id       text not null unique,
  -- Slug 32 chars sans tirets (déjà utilisé dans les URLs front).
  slug            text not null unique,
  -- 'resource' = ressource éducative avec body (contenu rich Notion).
  -- 'template' = template Notion public à dupliquer (urls externes).
  category        text not null check (category in ('resource', 'template')),
  titre           text not null,
  description     text,
  visibilite      text not null check (visibilite in (
                    'Publique',
                    'Challenge Gratuit',
                    'Formation',
                    'Accompagnement'
                  )),
  -- Multi-select Notion (Formation: Notion Business / Notion Architecte).
  -- Vide pour les templates.
  formation       text[] not null default '{}',
  -- Multi-select Notion pour resource (Relation Client, Production, etc.).
  -- Pour template, single-select reformaté en array de longueur 1 par le sync.
  type            text[] not null default '{}',
  -- Body parsé en blocs (resource uniquement). Null pour template.
  content         jsonb,
  -- URLs externes (template uniquement).
  url_notion_public_page  text,
  url_tella               text,
  date_creation   timestamptz not null,
  synced_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.resources is
  'Cache des ressources & templates Notion. Alimenté par /api/ressources/sync. Body lourd TOASTé.';

create index if not exists resources_category_idx
  on public.resources (category, date_creation desc);
create index if not exists resources_visibilite_idx
  on public.resources (visibilite);

drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

-- ============================================================================
-- B — resources_access (mapping visibilité Notion → capability Supabase)
-- ============================================================================
-- Mappage 1-pour-1 entre une valeur de "Visibilité" Notion et une capability.
-- required_capability nullable : Publique = aucun gating, accessible à tout
-- user authentifié.
create table if not exists public.resources_access (
  visibilite           text primary key check (visibilite in (
                         'Publique',
                         'Challenge Gratuit',
                         'Formation',
                         'Accompagnement'
                       )),
  required_capability  text
                       check (required_capability is null or required_capability in (
                         'can_access_challenge_program',
                         'can_access_paid_programs'
                       )),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.resources_access is
  'Mapping visibilité ressource Notion → capability Supabase. NULL capability = pas de gating.';

drop trigger if exists resources_access_set_updated_at on public.resources_access;
create trigger resources_access_set_updated_at
  before update on public.resources_access
  for each row execute function public.set_updated_at();

-- Seed initial du mapping :
--   Publique         → accessible à tout user authentifié (capability = NULL)
--   Challenge Gratuit → can_access_challenge_program (par défaut tout user a ça)
--   Formation         → can_access_paid_programs
--   Accompagnement    → can_access_paid_programs (même capability — voir décision
--                       session 2026-06-04 : pas de capability coaching dédiée
--                       pour V1, on peut affiner plus tard si besoin).
insert into public.resources_access (visibilite, required_capability) values
  ('Publique',          null),
  ('Challenge Gratuit', 'can_access_challenge_program'),
  ('Formation',         'can_access_paid_programs'),
  ('Accompagnement',    'can_access_paid_programs')
on conflict (visibilite) do nothing;

-- ============================================================================
-- C — RLS
-- ============================================================================

-- ── Structure : lecture filtrée par capability (ou admin). Écriture = service_role.
alter table public.resources enable row level security;

drop policy if exists resources_select on public.resources;
create policy resources_select
  on public.resources for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or exists (
      select 1 from public.resources_access ra
      where ra.visibilite = public.resources.visibilite
        and (
          ra.required_capability is null
          or public.user_has_capability((select auth.uid()), ra.required_capability)
        )
    )
  );

-- ── resources_access : lecture pour authentifiés (catalogue de config).
alter table public.resources_access enable row level security;

drop policy if exists resources_access_select on public.resources_access;
create policy resources_access_select
  on public.resources_access for select to authenticated
  using (true);
-- Écriture : service_role uniquement (admin).
