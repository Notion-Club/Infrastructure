-- ============================================================================
-- 015 — Storage bucket `avatars` : limite de taille + MIME types autorisés
-- ============================================================================
-- Contexte : la limite implicite du bucket (héritée du plan Supabase) était
-- trop faible pour des photos « classiques » prises au smartphone (3-4 MB en
-- JPEG HEIC converti), ce qui faisait échouer l'upload avant même d'atteindre
-- notre validation métier. On aligne ici la limite côté storage sur
-- AVATAR_MAX_BYTES (5 MB) et on restreint explicitement les MIME types
-- autorisés à ceux qu'on traite côté code (PNG/JPEG/WebP).
--
-- Idempotent : un simple UPDATE qui peut être re-joué sans effet de bord.

update storage.buckets
set
  file_size_limit = 5242880, -- 5 MB = 5 * 1024 * 1024
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'avatars';
