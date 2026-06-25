-- Migration 044 — Brique Community — push admin dans le centre in-app
--
-- Date    : 2026-06-25
-- Auteur  : Notion Club Infra
-- Module  : community (suite de 038_notifications.sql)
--
-- Pitch
-- -----
-- Jusqu'ici, un push envoyé manuellement depuis l'outil admin (DevToolbox →
-- AdminPushDevCard → sendAdminPushAction) ou via /api/push/send partait sur le
-- téléphone mais ne laissait AUCUNE trace dans le centre de notifications
-- in-app : ces deux chemins appellent sendWebPushToUser en direct, sans passer
-- par la table `notifications` (alimentée jusqu'ici uniquement par les triggers
-- d'événements communautaires de la mig. 038). Résultat : la cloche restait
-- vide alors que le push s'affichait bien sur l'appareil.
--
-- Cette migration ouvre la table `notifications` au cas « push admin / système »
-- pour qu'un push manuel s'affiche désormais à l'identique dans la cloche
-- (même titre, même corps, lien cliquable).
--
-- Ce qui change sur le schéma
-- ---------------------------
--   1. Nouveau type 'admin_push' dans le CHECK de notifications.type — un push
--      libre, distinct de 'admin_annonce' (post taggé annonce → fan-out trigger).
--   2. Colonne `title` (text) : un push admin porte son propre titre libre,
--      contrairement aux notifs community dont le titre est dérivé de
--      l'acteur + un verbe figé côté UI.
--   3. Colonne `link` (text) : deep-link libre (chemin relatif ou URL absolue)
--      ouvert au tap, là où les notifs community déduisent le lien de
--      post_id / conversation_id.
--   4. actor_id rendu NULLABLE : un push admin/système n'a pas forcément
--      d'« acteur » (la route /api/push/send est machine-to-machine, sans user
--      authentifié). Côté UI, admin_push s'affiche avec l'identité Notion Club,
--      pas avec un profil émetteur.
--
-- Compatibilité : purement additif. Les triggers et notifs existantes ne sont
-- pas touchés (ils continuent de renseigner actor_id et laissent title/link à
-- NULL). L'insertion des push admin se fait côté serveur via le service_role
-- (bypass RLS) — pas de nouvelle policy ni de nouveau trigger ici.
-- =============================================================================

begin;

-- 1. actor_id nullable — un push admin/système peut ne pas avoir d'acteur.
--    La FK (ON DELETE CASCADE) et l'index restent valides ; on ne fait que
--    lever la contrainte NOT NULL.
alter table public.notifications
  alter column actor_id drop not null;

comment on column public.notifications.actor_id is
  'Profil à l''origine de l''événement. NULL pour un push admin/système '
  '(type admin_push) émis sans acteur. Jamais égal à recipient_id pour les '
  'notifs community (les triggers skippent l''auto-notification).';

-- 2. Étendre le CHECK type → ajouter 'admin_push'. La contrainte inline de la
--    mig. 038 porte le nom auto-généré `notifications_type_check`. On la drop
--    (IF EXISTS pour rester idempotent / robuste à un renommage) et on la
--    recrée nommée, avec la valeur supplémentaire.
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'mention_post',
    'mention_comment',
    'comment_on_post',
    'reply_to_comment',
    'reaction_on_post',
    'new_dm',
    'admin_annonce',
    'admin_push'
  ));

-- 3. Colonnes libres pour un push admin : titre + lien.
alter table public.notifications
  add column if not exists title text;
alter table public.notifications
  add column if not exists link  text;

comment on column public.notifications.title is
  'Titre libre — renseigné uniquement pour les push admin (type admin_push). '
  'NULL pour les notifs community (titre dérivé acteur + verbe côté UI).';
comment on column public.notifications.link is
  'Deep-link libre (chemin relatif ou URL absolue) ouvert au tap. Renseigné '
  'pour les push admin (admin_push). Les notifs community déduisent le lien de '
  'post_id / conversation_id.';

commit;
