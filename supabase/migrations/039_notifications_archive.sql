-- Migration 039 — Brique Community — archivage des notifications in-app
--
-- Date    : 2026-06-18
-- Auteur  : Notion Club Infra
-- Module  : community (suite de 038_notifications.sql)
--
-- Pitch
-- -----
-- La 038 a posé la table `notifications` (read_at NULL = non lue) et la cloche
-- in-app. Cette migration ajoute l'**archivage par utilisateur** : chaque
-- membre peut faire disparaître une notification de son centre sans toucher à
-- celles des autres. On distingue désormais deux axes indépendants :
--   - read_at      → lue / non lue (badge, onglets "Non-lues" / "Lues")
--   - archived_at  → archivée (sortie du feed, plus affichée nulle part)
--
-- L'archivage est strictement par destinataire : la colonne vit sur la ligne
-- `notifications` qui est déjà scopée `recipient_id`, et la RLS existante
-- (`notifications_update_self`) borne tout UPDATE aux lignes du user courant.
-- Aucune nouvelle policy n'est donc nécessaire — un user n'archive que SES
-- notifs, jamais celles d'un autre.
--
-- Choix d'architecture
-- --------------------
--   - Colonne nullable `archived_at` (timestamptz) plutôt que booléen : garde
--     la trace de QUAND l'archivage a eu lieu (cohérent avec read_at).
--   - Additif et idempotent (ADD COLUMN IF NOT EXISTS) : zéro impact sur les
--     lignes existantes (archived_at NULL = active, comportement actuel).
--   - Index partiel sur le feed actif (archived_at IS NULL) pour que la lecture
--     du centre — qui exclut désormais les archivées — reste rapide même avec
--     un gros historique d'archives.
--   - Realtime : aucun changement requis. La table est déjà publiée (038) avec
--     REPLICA IDENTITY FULL ; l'archivage est un simple UPDATE qui remonte au
--     client via postgres_changes (event '*').
-- =============================================================================

begin;

-- =============================================================================
-- 1. Colonne archived_at
-- =============================================================================
-- NULL = notification active (dans le feed). Stamp = archivée (masquée du
-- centre pour ce destinataire uniquement).

alter table public.notifications
  add column if not exists archived_at timestamptz;

comment on column public.notifications.archived_at is
  'NULL = active (affichée dans le centre). Stamp = archivée par le '
  'destinataire (masquée du feed). Par-utilisateur : la ligne est déjà scopée '
  'recipient_id, la RLS update_self borne l''archivage au user courant.';

-- =============================================================================
-- 2. Index partiel — feed actif (non archivé) trié antichronologiquement
-- =============================================================================
-- getNotifications() lit désormais WHERE archived_at IS NULL ORDER BY
-- created_at DESC. Cet index partiel couvre exactement ce chemin et reste
-- compact (n'indexe pas les archives).

create index if not exists notifications_recipient_active_idx
  on public.notifications (recipient_id, created_at desc)
  where archived_at is null;

-- =============================================================================
-- 3. RLS — rien à ajouter
-- =============================================================================
-- notifications_update_self (mig. 038) couvre déjà l'UPDATE de archived_at sur
-- les lignes du user courant (using/with check recipient_id = auth.uid()).
-- L'archivage passe donc par le même chemin sécurisé que le mark-as-read.

commit;
