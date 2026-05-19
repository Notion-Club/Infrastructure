-- Migration 008 — Brique 1 (settings) — password reuse prevention
-- Stocke un historique de hashes bcrypt des derniers mots de passe choisis
-- par chaque user pour empêcher la réutilisation des N derniers (OWASP).
--
-- Pourquoi cette table existe :
--   Supabase stocke le mdp dans auth.users.encrypted_password (bcrypt) mais
--   le schema `auth` n'est pas lisible via l'API publique. On maintient donc
--   notre propre table de hashes côté `public`.
--
-- Sécurité :
--   - Hash bcrypt côté Node (bcryptjs) avec cost 10
--   - RLS enable + AUCUNE policy = DENY ALL pour le rôle `authenticated`.
--     Toutes les lectures/écritures passent par le service-role client
--     (createSupabaseAdminClient) depuis nos Server Actions uniquement.
--   - L'user lui-même ne peut JAMAIS lire ses propres hashes (utile uniquement
--     pour la comparaison côté serveur, jamais à exposer).

create table if not exists public.password_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

comment on table public.password_history is
  'Historique des hashes bcrypt des derniers mots de passe par user. Lecture/écriture via service-role uniquement (DENY ALL via RLS).';
comment on column public.password_history.password_hash is
  'Hash bcrypt (cost 10) du mot de passe. Calculé côté Node via bcryptjs.';

-- Index pour récupérer rapidement les N derniers par user (DESC sur created_at).
create index if not exists password_history_user_id_created_at_idx
  on public.password_history (user_id, created_at desc);

-- RLS : aucune policy = DENY ALL. Seul le service-role bypass.
alter table public.password_history enable row level security;
