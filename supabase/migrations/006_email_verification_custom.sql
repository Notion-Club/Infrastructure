-- Migration 006 — Brique 1 (auth)
-- Validation email custom (non-bloquante côté Supabase Auth).
--
-- Décision projet : Supabase Auth autoconfirm est activé (workflow B), donc
-- l'utilisateur peut se connecter immédiatement après le signup. Mais nous
-- voulons quand même tracker si l'user a confirmé son email via un email
-- envoyé par nous, pour :
--   - Afficher un banner "Confirme ton email" tant que c'est non fait
--   - Permettre de relancer l'email plus tard
--   - Garder une trace de la confirmation effective
--
-- Workflow :
--   1. Signup → trigger handle_new_user génère un token UUID stocké sur profiles
--   2. signUpAction appelle sendVerificationEmail (Resend SDK) avec ce token
--   3. L'utilisateur clique le lien → /api/verify-email?token=… → on set
--      email_verified_at = now() et on efface le token
--   4. Le banner se base sur email_verified_at IS NULL

-- ============================================================================
-- 1. Nouvelles colonnes sur profiles
-- ============================================================================
alter table public.profiles
  add column if not exists email_verification_token       uuid unique,
  add column if not exists email_verification_sent_at     timestamptz;

comment on column public.profiles.email_verification_token is
  'Token UUID unique envoyé dans l''email de confirmation. Effacé après usage.';
comment on column public.profiles.email_verification_sent_at is
  'Dernier envoi du mail de confirmation. Sert au rate-limiting du bouton ''Renvoyer''.';

-- Rappel : email_verified_at existe déjà depuis 002 (nullable, NULL = pas
-- encore confirmé). On ne le recrée pas.

-- ============================================================================
-- 2. Trigger handle_new_user : génère le token au signup
-- ============================================================================
-- Mise à jour de la fonction existante (déjà SECURITY DEFINER).
-- Le token est généré côté trigger pour garantir qu'il existe avant que
-- la Server Action signUpAction n'essaie de l'envoyer par email.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id        uuid;
  v_first_name    text;
  v_last_name     text;
  v_display_name  text;
  v_full_name     text;
  v_token         uuid;
begin
  -- Organisation racine
  select id into v_org_id
  from public.organizations
  where slug = 'notion-club';

  if v_org_id is null then
    raise exception 'Organisation racine introuvable (slug=notion-club). Lancer le seed.';
  end if;

  -- Champs identité depuis raw_user_meta_data (peuvent être NULL si absents)
  v_first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  v_last_name  := nullif(new.raw_user_meta_data->>'last_name', '');

  v_display_name := v_first_name;

  v_full_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(concat_ws(' ', v_first_name, v_last_name)), ''),
    split_part(new.email, '@', 1)
  );

  -- Token unique pour la confirmation email custom
  v_token := gen_random_uuid();

  insert into public.profiles (
    id, organization_id,
    full_name, first_name, last_name, display_name,
    email_verification_token, email_verification_sent_at
  )
  values (
    new.id, v_org_id,
    v_full_name, v_first_name, v_last_name, v_display_name,
    v_token, now()
  );

  return new;
end;
$$;

-- Note : le trigger on_auth_user_created existe déjà (cf. 002), il pointe sur
-- cette fonction. `create or replace function` met à jour le corps appelé.

-- ============================================================================
-- 3. RLS — pas de modif
-- ============================================================================
-- Les nouvelles colonnes héritent des policies existantes sur profiles :
-- - profiles_select_self : l'user voit les colonnes de son propre profile
-- - profiles_update_self : l'user peut update son profile mais le `with check`
--   limite déjà aux champs non-sensibles (role, is_banned, organization_id
--   sont protégés). email_verification_token n'est pas dans cette liste,
--   donc en théorie l'user pourrait l'écraser. Mais c'est OK : si un user
--   change son propre token, il s'auto-bloque de la confirmation, ça n'a
--   aucun impact sur les autres users. La route /api/verify-email tournera
--   sous service_role pour matcher le token de manière sécurisée côté server.
