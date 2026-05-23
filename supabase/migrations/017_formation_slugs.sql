-- Migration 017 — Brique 2 (formation) — slugs URL pour modules & cours
--
-- Les routes /formation/[programSlug]/[moduleSlug]/[lessonSlug] ont besoin de
-- slugs lisibles et stables. La formation a déjà `slug`. On ajoute slug aux
-- modules (unique par formation) et aux cours (unique par module). Peuplés
-- par la sync (slugify du nom, suffixe position en cas de collision).

alter table public.formation_modules
  add column if not exists slug text;

alter table public.formation_courses
  add column if not exists slug text;

-- Unicité par parent (et non globale) — deux modules de formations
-- différentes peuvent partager un slug, idem cours entre modules.
create unique index if not exists formation_modules_formation_slug_idx
  on public.formation_modules (formation_id, slug);

create unique index if not exists formation_courses_module_slug_idx
  on public.formation_courses (module_id, slug);
