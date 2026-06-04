-- Migration 034 — Brique Coaching V1 — table coaching_calls
--
-- Stocke les appels coaching de chaque membre (passés, à venir, no-show).
-- Cache des données qui viendront initialement de Notion (sync futur) ou
-- entrées manuellement par admin via une interface à venir.
--
-- ⚠️  L'identité du membre est référencée par profile_id (FK auth) ET par
--    notion_member_page_id (clé Notion). Les deux sont stockés pour faciliter
--    la sync Notion ↔ Supabase : le sync peut résoudre une page Notion vers
--    un profile_id via cette clé, et on garde le notion_member_page_id pour
--    déboguer / re-sync.
--
-- Décision V1 : pas de table coaching_eligibility séparée pour l'instant —
-- le statut "accompagnement_eligible" / "_not_eligible" / "_expired" se
-- dérive des memberships + capabilities (can_book_calls) et de la date du
-- dernier appel. Si la logique devient complexe, on extrait dans une vue.

-- ============================================================================
-- 1. Table coaching_calls
-- ============================================================================
create table if not exists public.coaching_calls (
  id                       uuid primary key default gen_random_uuid(),
  profile_id               uuid not null references public.profiles(id) on delete cascade,
  -- Stockée pour traçabilité Notion → Supabase (pas FK).
  notion_member_page_id    text,
  notion_call_page_id      text unique, -- ID Notion de la page Call (pour idempotence sync)
  scheduled_at             timestamptz not null,
  host                     text not null, -- nom du coach (Théo, Noah, ...)
  subject                  text,
  status                   text not null
                           check (status in ('upcoming', 'accepted', 'no_show', 'cancelled')),
  ai_summary               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.coaching_calls is
  'Appels coaching par membre. Source future : sync Notion DB Calls. Lecture self + admin.';

create index if not exists coaching_calls_profile_idx
  on public.coaching_calls (profile_id, scheduled_at desc);
create index if not exists coaching_calls_status_idx
  on public.coaching_calls (status, scheduled_at);

drop trigger if exists coaching_calls_set_updated_at on public.coaching_calls;
create trigger coaching_calls_set_updated_at
  before update on public.coaching_calls
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. RLS
-- ============================================================================
alter table public.coaching_calls enable row level security;

-- ── Lecture : self ou admin
drop policy if exists coaching_calls_select_self_or_admin on public.coaching_calls;
create policy coaching_calls_select_self_or_admin
  on public.coaching_calls for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.current_profile_role() = 'admin'
  );

-- ── Écriture : service_role uniquement (sync admin ou import manuel).
-- Pas de policy insert/update/delete pour authenticated.
