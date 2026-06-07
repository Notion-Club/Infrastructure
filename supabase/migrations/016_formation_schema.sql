-- Migration 016 — Brique 2 (formation) — structure cache + accès + progression
--
-- Trois couches (cf. décision archi formation) :
--   A. Cache de structure (partagé, alimenté par /api/formation/sync depuis Notion) :
--        formations, formation_modules, formation_courses
--      → métadonnées légères UNIQUEMENT (pas le body markdown des cours,
--        qui reste lazy-load depuis Notion au clic).
--   B. Mapping d'accès (config) :
--        formation_access — relie une formation Notion à une capability Supabase
--        et un mode d'accès (strict/open/hybrid).
--   C. Progression par utilisateur (persistée serveur, jamais en local) :
--        formation_course_progress, formation_course_notes
--      → un membre ne voit/modifie que sa progression ; un admin peut LIRE
--        celle de tous (pattern memberships).
--
-- ⚠️  La RLS de lecture de structure repose sur user_has_capability() et le
--     mapping formation_access. Une faille = leak de contenu payant à un user
--     sans l'offre. L'écriture de structure passe exclusivement par
--     service_role (sync admin) — aucune policy d'écriture exposée.
--
-- Les IDs Notion sont stockés au format canonique de l'API (UUID avec tirets).
-- La sync normalise systématiquement à ce format.

-- ============================================================================
-- A.1 — formations (cache structure)
-- ============================================================================
create table if not exists public.formations (
  id            uuid primary key default gen_random_uuid(),
  notion_id     text not null unique,
  slug          text not null unique,
  name          text not null,
  description   text,
  position      integer not null default 0,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.formations is
  'Cache léger des formations Notion (base Formations). Body non stocké. Alimenté par la sync.';

drop trigger if exists formations_set_updated_at on public.formations;
create trigger formations_set_updated_at
  before update on public.formations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- A.2 — formation_modules (cache structure)
-- ============================================================================
create table if not exists public.formation_modules (
  id            uuid primary key default gen_random_uuid(),
  notion_id     text not null unique,
  formation_id  uuid not null references public.formations(id) on delete cascade,
  name          text not null,
  -- Ordre du module (propriété "ID" dans Notion).
  position      integer not null default 0,
  cover_url     text,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.formation_modules is
  'Cache léger des modules Notion (base Modules). Body non stocké.';

create index if not exists formation_modules_formation_idx
  on public.formation_modules (formation_id, position);

drop trigger if exists formation_modules_set_updated_at on public.formation_modules;
create trigger formation_modules_set_updated_at
  before update on public.formation_modules
  for each row execute function public.set_updated_at();

-- ============================================================================
-- A.3 — formation_courses (cache structure)
-- ============================================================================
create table if not exists public.formation_courses (
  id            uuid primary key default gen_random_uuid(),
  notion_id     text not null unique,
  module_id     uuid not null references public.formation_modules(id) on delete cascade,
  -- Dénormalisation : permet de filtrer/joindre par formation sans passer
  -- par le module (RLS, stats admin).
  formation_id  uuid not null references public.formations(id) on delete cascade,
  name          text not null,
  description   text,
  -- Ordre dans le module (propriété "Numérotation" dans Notion).
  position      integer not null default 0,
  is_default    boolean not null default false,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.formation_courses is
  'Cache léger des cours Notion (base Cours). Le body markdown reste lazy-load depuis Notion.';

create index if not exists formation_courses_module_idx
  on public.formation_courses (module_id, position);
create index if not exists formation_courses_formation_idx
  on public.formation_courses (formation_id, position);

drop trigger if exists formation_courses_set_updated_at on public.formation_courses;
create trigger formation_courses_set_updated_at
  before update on public.formation_courses
  for each row execute function public.set_updated_at();

-- ============================================================================
-- B — formation_access (mapping config offre/capability → formation)
-- ============================================================================
-- Clé par notion_formation_id (pas de FK) : le mapping est de la config qui
-- peut préexister à la première sync. La capability est validée par un check
-- aligné sur la whitelist de user_has_capability (capabilities formation).
create table if not exists public.formation_access (
  id                   uuid primary key default gen_random_uuid(),
  notion_formation_id  text not null unique,
  required_capability  text not null
                       check (required_capability in (
                         'can_access_challenge_program',
                         'can_access_paid_programs'
                       )),
  access_mode          text not null default 'strict'
                       check (access_mode in ('strict', 'open', 'hybrid')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.formation_access is
  'Mapping config : quelle capability et quel mode d''accès pour une formation Notion. Édité par admin/service_role.';

drop trigger if exists formation_access_set_updated_at on public.formation_access;
create trigger formation_access_set_updated_at
  before update on public.formation_access
  for each row execute function public.set_updated_at();

-- Mapping initial : "Devenir consultant Notion" → offre payante, drip strict.
insert into public.formation_access (notion_formation_id, required_capability, access_mode)
values ('369bad05-6a95-80a2-abeb-ed9778497ed3', 'can_access_paid_programs', 'strict')
on conflict (notion_formation_id) do nothing;

-- ============================================================================
-- C.1 — formation_course_progress (progression par user)
-- ============================================================================
create table if not exists public.formation_course_progress (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  course_id        uuid not null references public.formation_courses(id) on delete cascade,
  status           text not null default 'in_progress'
                   check (status in ('in_progress', 'completed')),
  completed_at     timestamptz,
  last_accessed_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (profile_id, course_id)
);

comment on table public.formation_course_progress is
  'Progression individuelle par cours. Persistée serveur. Lisible par soi ou un admin.';

create index if not exists fcp_profile_idx
  on public.formation_course_progress (profile_id, last_accessed_at desc);
create index if not exists fcp_course_idx
  on public.formation_course_progress (course_id);

drop trigger if exists fcp_set_updated_at on public.formation_course_progress;
create trigger fcp_set_updated_at
  before update on public.formation_course_progress
  for each row execute function public.set_updated_at();

-- ============================================================================
-- C.2 — formation_course_notes (notes perso par user)
-- ============================================================================
create table if not exists public.formation_course_notes (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  course_id     uuid not null references public.formation_courses(id) on delete cascade,
  content       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (profile_id, course_id)
);

comment on table public.formation_course_notes is
  'Notes perso par cours. Persistée serveur. Lisible par soi ou un admin.';

create index if not exists fcn_profile_idx
  on public.formation_course_notes (profile_id);

drop trigger if exists fcn_set_updated_at on public.formation_course_notes;
create trigger fcn_set_updated_at
  before update on public.formation_course_notes
  for each row execute function public.set_updated_at();

-- ============================================================================
-- D — RLS
-- ============================================================================

-- ── Structure : lecture filtrée par capability (ou admin). Écriture = service_role.
alter table public.formations enable row level security;

drop policy if exists formations_select on public.formations;
create policy formations_select
  on public.formations for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or exists (
      select 1 from public.formation_access fa
      where fa.notion_formation_id = public.formations.notion_id
        and public.user_has_capability((select auth.uid()), fa.required_capability)
    )
  );

alter table public.formation_modules enable row level security;

drop policy if exists formation_modules_select on public.formation_modules;
create policy formation_modules_select
  on public.formation_modules for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or exists (
      select 1
      from public.formations f
      join public.formation_access fa on fa.notion_formation_id = f.notion_id
      where f.id = public.formation_modules.formation_id
        and public.user_has_capability((select auth.uid()), fa.required_capability)
    )
  );

alter table public.formation_courses enable row level security;

drop policy if exists formation_courses_select on public.formation_courses;
create policy formation_courses_select
  on public.formation_courses for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or exists (
      select 1
      from public.formations f
      join public.formation_access fa on fa.notion_formation_id = f.notion_id
      where f.id = public.formation_courses.formation_id
        and public.user_has_capability((select auth.uid()), fa.required_capability)
    )
  );

-- ── formation_access : lecture pour authentifiés (catalogue de config).
alter table public.formation_access enable row level security;

drop policy if exists formation_access_select on public.formation_access;
create policy formation_access_select
  on public.formation_access for select to authenticated
  using (true);
-- Écriture : service_role uniquement (sync / admin).

-- ── Progression : self read+write, admin read-only.
alter table public.formation_course_progress enable row level security;

drop policy if exists fcp_select_self_or_admin on public.formation_course_progress;
create policy fcp_select_self_or_admin
  on public.formation_course_progress for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.current_profile_role() = 'admin'
  );

drop policy if exists fcp_insert_self on public.formation_course_progress;
create policy fcp_insert_self
  on public.formation_course_progress for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists fcp_update_self on public.formation_course_progress;
create policy fcp_update_self
  on public.formation_course_progress for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists fcp_delete_self on public.formation_course_progress;
create policy fcp_delete_self
  on public.formation_course_progress for delete to authenticated
  using (profile_id = (select auth.uid()));

-- ── Notes : self read+write, admin read-only.
alter table public.formation_course_notes enable row level security;

drop policy if exists fcn_select_self_or_admin on public.formation_course_notes;
create policy fcn_select_self_or_admin
  on public.formation_course_notes for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.current_profile_role() = 'admin'
  );

drop policy if exists fcn_insert_self on public.formation_course_notes;
create policy fcn_insert_self
  on public.formation_course_notes for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists fcn_update_self on public.formation_course_notes;
create policy fcn_update_self
  on public.formation_course_notes for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists fcn_delete_self on public.formation_course_notes;
create policy fcn_delete_self
  on public.formation_course_notes for delete to authenticated
  using (profile_id = (select auth.uid()));
