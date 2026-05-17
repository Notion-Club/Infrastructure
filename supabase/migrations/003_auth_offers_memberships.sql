-- Migration 003 — Brique 1 (auth)
-- Système d'autorisation capabilities-based :
--   offers       : catalogue des offres avec leurs capabilities (booléens)
--   memberships  : lien user ↔ offer, avec statut/expiration
--   membership_changes : audit trail
--   user_has_capability() : la fonction qui décide si un user a un droit
--
-- ⚠️  Ticket Sensible — c'est le cœur du système d'autorisation.
--     Une faille ici = bypass de paiement.
--     Points critiques :
--       (a) Whitelist explicite des capabilities dans user_has_capability :
--           refuse toute capability inconnue (prévention SQL injection
--           via nom de colonne).
--       (b) OR-logique : un user peut cumuler plusieurs offres. La capability
--           est TRUE si AU MOINS UNE offre active la donne.
--       (c) expires_at NULL = accès à vie. À vérifier : (expires_at IS NULL OR expires_at > now()).

-- ============================================================================
-- 1. Table offers — catalogue des offres
-- ============================================================================
create table if not exists public.offers (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique,
  name                      text not null,
  description               text,

  -- ── Capabilities (booléens) ────────────────────────────────────────────
  -- Toute capability ajoutée ici DOIT être ajoutée dans la whitelist de
  -- la fonction user_has_capability ci-dessous.
  can_access_challenge_program boolean not null default false,
  can_access_paid_programs     boolean not null default false,
  can_message_admins           boolean not null default false,
  can_view_community           boolean not null default false,
  can_book_calls               boolean not null default false,
  can_view_call_summaries      boolean not null default false,
  can_access_templates_library boolean not null default false,

  -- ── Économie ───────────────────────────────────────────────────────────
  is_paid                   boolean not null default false,
  default_price_eur         numeric(10,2),
  -- NULL = durée non bornée (lifetime). Sinon, nb de jours.
  default_duration_days     integer,

  -- Soft-delete logique (préférer désactiver plutôt que supprimer)
  is_active                 boolean not null default true,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.offers is
  'Catalogue des offres avec leurs capabilities. Mise à jour rare.';

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. Table memberships — lien profile ↔ offer
-- ============================================================================
create table if not exists public.memberships (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  offer_id            uuid not null references public.offers(id),
  -- Dénormalisation pour requêtes RLS et perf (évite un JOIN sur profiles)
  organization_id     uuid not null references public.organizations(id),

  -- Cycle de vie
  status              text not null default 'active'
                      check (status in ('active', 'expired', 'cancelled', 'refunded', 'paused')),

  -- Provenance (analytics + debug)
  source              text,        -- 'lp_challenge', 'stripe', 'admin_grant', 'sync_notion', etc.

  -- Tarification effective au moment de l'achat
  price_paid_eur      numeric(10,2),

  -- Type de durée (cf. Notion DB Membres) — pilote le calcul de expires_at
  duration_type       text check (duration_type in ('lifetime', 'days_120', 'no_accompaniment')),

  -- Bornes temporelles. expires_at NULL = accès à vie.
  starts_at           timestamptz not null default now(),
  expires_at          timestamptz,

  -- Référence externe (Stripe checkout, ligne sync Notion, etc.)
  external_ref        text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists memberships_profile_active_idx
  on public.memberships (profile_id, status) where status = 'active';
create index if not exists memberships_offer_idx
  on public.memberships (offer_id);

drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. Table membership_changes — audit trail
-- ============================================================================
create table if not exists public.membership_changes (
  id              uuid primary key default gen_random_uuid(),
  membership_id   uuid not null references public.memberships(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  -- 'created', 'status_changed', 'extended', 'expired', 'cancelled', etc.
  change_type     text not null,
  old_status      text,
  new_status      text,
  old_expires_at  timestamptz,
  new_expires_at  timestamptz,
  reason          text,
  -- Qui a déclenché le changement. NULL = système (job auto, sync, etc.)
  changed_by      uuid references public.profiles(id),
  changed_at      timestamptz not null default now()
);

create index if not exists membership_changes_membership_idx
  on public.membership_changes (membership_id, changed_at desc);

-- ============================================================================
-- 4. Fonction user_has_capability — cœur du système d'autorisation
-- ============================================================================
-- Retourne TRUE si l'user a AU MOINS UNE membership active dont l'offre
-- a la capability demandée à TRUE.
--
-- Sécurité :
--   - SECURITY DEFINER + search_path = '' : isole le contexte d'exécution.
--   - Whitelist explicite des capabilities : raise exception si inconnu.
--     Sans ça, un appelant malveillant pourrait passer un nom de colonne
--     arbitraire et lire n'importe quoi.
--
-- Performance :
--   - STABLE : Postgres peut cacher le résultat dans la même requête.
create or replace function public.user_has_capability(
  p_profile_id uuid,
  p_capability text
)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_result boolean;
begin
  -- Whitelist : seules ces colonnes sont des capabilities légitimes.
  -- Toute addition ici DOIT correspondre à une colonne booléenne sur
  -- public.offers (cf. migration 003, section 1).
  if p_capability not in (
    'can_access_challenge_program',
    'can_access_paid_programs',
    'can_message_admins',
    'can_view_community',
    'can_book_calls',
    'can_view_call_summaries',
    'can_access_templates_library'
  ) then
    raise exception 'Capability inconnue: %', p_capability
      using errcode = 'invalid_parameter_value';
  end if;

  -- Construction dynamique du nom de colonne — sûre car la valeur a été
  -- validée contre la whitelist juste au-dessus. format(%I) quote l'identifier.
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
  'Retourne TRUE si le user a au moins une membership active dont l''offre porte la capability. Whitelist anti-injection.';

-- ============================================================================
-- 5. RLS
-- ============================================================================

-- ── offers : lecture publique pour authentifiés ────────────────────────────
alter table public.offers enable row level security;

drop policy if exists offers_select_authenticated on public.offers;
create policy offers_select_authenticated
  on public.offers for select to authenticated
  using (true);
-- Pas de policy d'écriture : seul service_role peut modifier le catalogue.

-- ── memberships : un user voit ses propres memberships uniquement ──────────
alter table public.memberships enable row level security;

drop policy if exists memberships_select_self on public.memberships;
create policy memberships_select_self
  on public.memberships for select to authenticated
  using (profile_id = (select auth.uid()));

-- Admins de l'org voient toutes les memberships de leur org
drop policy if exists memberships_select_admin on public.memberships;
create policy memberships_select_admin
  on public.memberships for select to authenticated
  using (
    exists (
      select 1 from public.profiles admin
      where admin.id = (select auth.uid())
        and admin.role in ('admin', 'super_admin')
        and admin.organization_id = public.memberships.organization_id
    )
  );
-- Pas de policy INSERT/UPDATE/DELETE : tout passe par service_role
-- (Server Action signup, sync Notion, webhooks Stripe).

-- ── membership_changes : aucun accès user ──────────────────────────────────
alter table public.membership_changes enable row level security;
-- Pas de policy : aucun rôle non-service ne peut lire/écrire.
