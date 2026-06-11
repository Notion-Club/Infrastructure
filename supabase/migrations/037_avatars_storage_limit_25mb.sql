-- ============================================================================
-- 037 — Storage bucket `avatars` : passer la limite de 5 MB à 25 MB (OPS-36)
-- ============================================================================
-- Note (2026-06-11) : ce fichier était à l'origine numéroté `031_…`, ce qui
-- créait un conflit de version avec `031_ressources_schema.sql` (deux
-- migrations avec la même clé `031` cassaient le tracker
-- `supabase_migrations.schema_migrations` au `supabase db push` : violation
-- PK 23505). Renommé en `037_…` après `036_push_subscriptions` pour
-- débloquer l'application.
-- Contexte : la limite de 5 MB (mig. 015) est trop basse en pratique. Les
-- photos prises au smartphone non-compressées (HEIC iPhone, JPEG HD Android)
-- dépassent régulièrement 5 MB, ce qui fait échouer l'upload avant même
-- qu'on puisse traiter le fichier. Risque de churn sur l'onboarding.
--
-- On passe à 25 MB côté Storage (aligné avec AVATAR_MAX_BYTES côté code).
-- 25 MB laisse une marge confortable pour les photos HD multi-cadre sans
-- exploser le quota global du plan Supabase (qui se compte en GB sur le
-- bucket entier).
--
-- Idempotent : simple UPDATE re-jouable sans effet de bord.

update storage.buckets
set file_size_limit = 26214400 -- 25 MB = 25 * 1024 * 1024
where id = 'avatars';
