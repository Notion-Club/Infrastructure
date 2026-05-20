-- Migration 011 — Brique 1 (settings) — couleur d'avatar personnalisable
-- Ajoute `profiles.avatar_color` : couleur HEX choisie par l'user pour son
-- avatar (fond du cercle quand pas de photo). Si NULL, on tombe sur la couleur
-- brand par défaut côté UI.
--
-- La validation de la palette (les HEX autorisés) est faite côté Server
-- Action via zod — on ne contraint pas en DB pour garder la flexibilité
-- d'évolution de la palette sans migration.

alter table public.profiles
  add column if not exists avatar_color text;

comment on column public.profiles.avatar_color is
  'Couleur HEX (#rrggbb) choisie par l''user pour son avatar. NULL = couleur brand par défaut. Palette autorisée définie côté applicatif.';
