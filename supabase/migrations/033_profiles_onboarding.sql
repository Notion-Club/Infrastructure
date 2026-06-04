-- Migration 033 — profiles : champs onboarding
--
-- Ajoute deux colonnes à profiles pour supporter le flow onboarding :
--   - objectives : array de strings, les objectifs sélectionnés par l'user.
--   - onboarding_completed_at : timestamp marquant la fin du flow.
--
-- Sémantique :
--   - NULL onboarding_completed_at = user n'a pas encore complété l'onboarding,
--     doit être redirigé vers /onboarding au prochain accès (app).
--   - NON NULL = onboarding fini, accès libre à l'app.
--
-- Nullable obligatoire pour ne rien casser sur les users existants. Backfill
-- en fin de migration : on grandfather TOUS les users existants pour qu'ils
-- ne soient pas piégés par le redirect à venir (LOT-A-15).
--
-- objectives nullable car (a) optionnel produit, (b) distinction null
-- (jamais demandé) vs '{}' (demandé et passé vide) utile pour analytics.

alter table public.profiles
  add column if not exists objectives text[],
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.objectives is
  'Liste libre des objectifs sélectionnés par l''user à l''onboarding. NULL = jamais demandé.';
comment on column public.profiles.onboarding_completed_at is
  'Marque la fin du flow onboarding. NULL = à compléter (déclencheur du redirect /onboarding).';

-- Backfill : les users qui existent AVANT cette migration sont marqués comme
-- onboarding_completed (sinon ils seraient bloqués au prochain login par le
-- redirect /onboarding qui sera ajouté côté layout par Théo).
-- On utilise created_at comme date plausible (pas now() pour ne pas dater le
-- complete au jour de la migration).
update public.profiles
   set onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
 where onboarding_completed_at is null;
