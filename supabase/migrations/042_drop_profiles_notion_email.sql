-- Migration 042 — Suppression définitive de profiles.notion_email
--
-- Le « mail Notion » séparé est retiré du produit : un seul champ email
-- (mail de connexion) subsiste côté UI. On supprime donc la colonne
-- `profiles.notion_email` (créée en migration 002).
--
-- Dépendance : la fonction SECURITY DEFINER `anonymize_account` (migration
-- 009) référence `notion_email` dans son UPDATE d'anonymisation. On la
-- recrée d'abord SANS cette colonne, sinon le DROP COLUMN laisserait une
-- fonction qui échoue à l'exécution (soft-delete RGPD cassé).

-- ============================================================================
-- 1. Recréer anonymize_account sans la ligne notion_email
-- ============================================================================
create or replace function public.anonymize_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  anonymized_email text;
begin
  if exists (
    select 1 from public.profiles
    where id = target_user_id and deleted_at is not null
  ) then
    raise exception 'account_already_deleted'
      using errcode = 'P0001';
  end if;

  anonymized_email := 'deleted+' || target_user_id::text || '@notionclub.fr';

  -- 1. Nettoie les champs identifiants côté profile
  update public.profiles set
    display_name        = null,
    first_name          = null,
    last_name           = null,
    phone               = null,
    avatar_url          = null,
    bio                 = null,
    communication_email = null,
    username            = null,
    notion_member_page_id = null,
    deleted_at          = now()
  where id = target_user_id;

  -- 2. Swap l'email auth + nullifie le password + clean metadata.
  update auth.users set
    email                = anonymized_email,
    encrypted_password   = null,
    email_confirmed_at   = null,
    phone                = null,
    phone_confirmed_at   = null,
    raw_user_meta_data   = '{}'::jsonb,
    raw_app_meta_data    = jsonb_build_object('providers', '[]'::jsonb)
  where id = target_user_id;

  -- 3. Supprime toutes les identities (email, google, etc.).
  delete from auth.identities
  where user_id = target_user_id;

  -- 4. Cleanup password_history.
  delete from public.password_history
  where user_id = target_user_id;
end;
$$;

comment on function public.anonymize_account(uuid) is
  'Anonymise un compte (soft-delete) : nullifie les champs PII, swap email, retire identities. Appelée uniquement par deleteAccountAction après re-auth.';

-- Re-applique les revokes (create or replace ne les conserve pas).
revoke execute on function public.anonymize_account(uuid) from public;
revoke execute on function public.anonymize_account(uuid) from authenticated;
revoke execute on function public.anonymize_account(uuid) from anon;

-- ============================================================================
-- 2. Drop de la colonne
-- ============================================================================
alter table public.profiles
  drop column if exists notion_email;
