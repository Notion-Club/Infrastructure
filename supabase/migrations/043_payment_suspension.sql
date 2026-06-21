-- Migration 043 — Chantier A (suspension d'accès sur impayé)
-- État de suspension paiement : registre Notion (DB Paiements) → état app.
--
-- ⚠️  Zone sensible — touche l'enum de statut des memberships, c'est-à-dire
--     le périmètre exact que lit le cœur d'autorisation user_has_capability().
--     À relire ligne par ligne (Nathan) avant apply.
--
-- Modèle mental :
--   Le passage active → payment_suspended SUFFIT à couper tout le contenu
--   payant. user_has_capability() (migration 003, l.176) et
--   get_user_capabilities() (migration 032) ne comptent QUE status = 'active'.
--   Un membership 'payment_suspended' perd donc toutes ses capabilities
--   automatiquement, SANS qu'on modifie une seule fonction d'autorisation.
--   → On NE TOUCHE PAS user_has_capability. C'est volontaire.
--
-- Ce que fait cette migration :
--   1. Étend les statuts autorisés de memberships.status (+ 'payment_suspended').
--   2. Ajoute 5 colonnes read-model sur profiles (réécrites par le cron de
--      dunning à chaque run — self-healing quotidien).
--   3. Crée la table payment_reminders (idempotence des emails de relance).
--   4. Documente les change_type d'audit réutilisés sur membership_changes.

-- ============================================================================
-- 1. memberships.status — ajout de 'payment_suspended'
-- ============================================================================
-- ⚠️  memberships.status est un `text` + CHECK constraint (migration 003,
--     l.70-71), PAS un enum Postgres natif. On NE PEUT PAS faire
--     `alter type ... add value`. On drop + recrée la contrainte en
--     recopiant À L'IDENTIQUE les 5 valeurs existantes + la nouvelle.
--
-- Nom de la contrainte : `memberships_status_check` — nom auto-généré par
-- Postgres pour un CHECK inline de colonne (<table>_<colonne>_check).
-- `if exists` rend l'opération sûre même si le nom différait.
alter table public.memberships
  drop constraint if exists memberships_status_check;

alter table public.memberships
  add constraint memberships_status_check
  check (status in (
    'active',            -- valeur existante (003)
    'expired',           -- valeur existante (003)
    'cancelled',         -- valeur existante (003)
    'refunded',          -- valeur existante (003)
    'paused',            -- valeur existante (003)
    'payment_suspended'  -- NOUVEAU (043) — impayé constaté par le cron de dunning
  ));

-- ⚠️  RAPPEL : on ne recrée PAS user_has_capability ni get_user_capabilities.
--     Elles filtrent déjà sur status = 'active' uniquement → 'payment_suspended'
--     est exclu d'office. Toute réécriture ici = risque de bypass de paiement.

-- ============================================================================
-- 2. profiles — colonnes read-model du dunning
-- ============================================================================
-- Toutes nullables avec défaut 'ok' / NULL : un profil jamais traité par le
-- cron reste en état neutre. Le cron réécrit ces colonnes à chaque run en
-- reflétant l'échéance LA PLUS URGENTE du membre (cas multi-échéances).
--
-- Lecture : déjà couverte par la policy profiles_select_self (migration 002,
-- l.125-128) — la RLS est par ligne, pas par colonne, donc l'user lit ces
-- nouvelles colonnes sur son propre profil sans policy supplémentaire.
-- Écriture : cron via service_role (bypass RLS).
alter table public.profiles
  add column if not exists payment_state text
    check (payment_state in ('ok', 'alert', 'suspended')) default 'ok',
  add column if not exists payment_due_date date,
  add column if not exists payment_amount_due numeric(10, 2),
  add column if not exists payment_source text
    check (payment_source in ('stripe', 'virement')),
  add column if not exists payment_installment_label text;

comment on column public.profiles.payment_state is
  'Read-model dunning (043). État affiché côté UI : ok | alert | suspended. Réécrit par le cron à chaque run. Source de vérité du gating = memberships.status, ces colonnes ne sont QUE de l''affichage.';
comment on column public.profiles.payment_due_date is
  'Date butoir de l''échéance la plus urgente (= Notion « Date de Paiement »).';
comment on column public.profiles.payment_amount_due is
  'Montant TTC dû de l''échéance la plus urgente.';
comment on column public.profiles.payment_source is
  'Origine de l''échéance la plus urgente : stripe | virement (= Notion « Source »).';
comment on column public.profiles.payment_installment_label is
  'Libellé « N°x/x » calculé par rang de Date de Paiement ascendant côté cron.';

-- ============================================================================
-- 3. Table payment_reminders — idempotence des emails de relance
-- ============================================================================
-- Une ligne = un email de relance envoyé pour (ligne de paiement Notion ×
-- type de relance). La contrainte unique garantit qu'on n'envoie jamais deux
-- fois le même type de relance pour la même échéance, même si le cron tourne
-- plusieurs fois dans la journée.
--
-- Pattern calqué sur la queue DM (dm_email_notifications) : idempotence par
-- existence de ligne. Ici l'insertion EST l'acte d'envoi (sent_at default now()).
create table if not exists public.payment_reminders (
  id                uuid primary key default gen_random_uuid(),
  -- ID de la page Notion (DB Paiements) de l'échéance concernée.
  notion_payment_id text not null,
  -- Type de relance : 3 bandes d'alerte + le mail de suspension.
  reminder_type     text not null
                    check (reminder_type in (
                      'alert_early',  -- J-7 → J-3
                      'alert_soon',   -- J-2 → J-1
                      'due_day',      -- jour J (échéance)
                      'suspended'     -- accès coupés
                    )),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  sent_at           timestamptz not null default now(),

  -- Idempotence : un seul email par (échéance, type de relance).
  constraint payment_reminders_unique_notion_type
    unique (notion_payment_id, reminder_type)
);

create index if not exists payment_reminders_profile_idx
  on public.payment_reminders (profile_id);

comment on table public.payment_reminders is
  'Idempotence + trace des emails de relance impayé (043). Insertion = envoi. Unique(notion_payment_id, reminder_type) empêche les doublons sur re-run du cron.';

-- ── RLS : aucun accès user (service_role only) ─────────────────────────────
-- Calqué sur membership_changes (migration 003, l.229-230) : RLS activée
-- SANS aucune policy → seul service_role (qui bypass la RLS) lit/écrit.
alter table public.payment_reminders enable row level security;
-- Pas de policy : tout passe par le cron en service_role.

-- ============================================================================
-- 4. Audit — réutilisation de membership_changes (pas de nouvelle table)
-- ============================================================================
-- Le cron et les actions admin journalisent chaque bascule dans la table
-- d'audit existante membership_changes (migration 003, section 3).
-- change_type utilisés par le Chantier A :
--   'payment_suspended'   — active → payment_suspended (impayé constaté)
--   'payment_reactivated' — payment_suspended → active (paiement régularisé)
-- changed_by NULL = système (cron). changed_by = uuid admin = action manuelle.
-- (Aucune contrainte SQL sur change_type — champ text libre, l.111 du 003.
--  Ce commentaire fait foi pour les valeurs attendues.)
