-- Migration 009 — Brique 1 (settings) — soft-delete de compte
-- Ajoute le mécanisme RGPD de suppression de compte par anonymisation
-- immédiate. Un cron de hard delete à 30j sera implémenté dans une migration
-- ultérieure (Brique 3 admin).
--
-- Stratégie :
--   1. Marker `profiles.deleted_at` pour identifier les comptes supprimés
--   2. Fonction SECURITY DEFINER `anonymize_account` appelée par Server
--      Action après re-auth — nullifie toutes les données identifiantes,
--      swap l'email, supprime le password, retire les identities OAuth
--   3. RLS : les comptes anonymisés n'apparaissent plus dans les SELECT
--      utilisateur courants (filter where deleted_at is null)
--
-- Sécurité : la fonction prend juste un `target_user_id` mais le caller
-- doit avoir établi que c'est bien le user courant (Server Action vérifie
-- `auth.uid() = target_user_id` avant l'appel).

-- ============================================================================
-- 1. Marker deleted_at sur profiles
-- ============================================================================
alter table public.profiles
  add column if not exists deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'Soft-delete marker. Null = compte actif. Set = compte anonymisé en attente de hard delete (cron 30j).';

-- Index partiel — la majorité des profils sont actifs, on n'indexe que les
-- supprimés pour des opérations de cleanup/cron.
create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at)
  where deleted_at is not null;

-- ============================================================================
-- 2. anonymize_account — fonction SECURITY DEFINER
-- ============================================================================
-- Appelée par `deleteAccountAction` côté serveur après vérification de
-- l'identité (re-auth password). Atomique : tout ou rien dans une seule
-- transaction Postgres.
--
-- SECURITY DEFINER + search_path vide : protection standard Supabase
-- (cf. migration 002 handle_new_user, migration 007 RLS helpers).
create or replace function public.anonymize_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  anonymized_email text;
begin
  -- Garde-fou : on refuse si la cible est déjà supprimée.
  if exists (
    select 1 from public.profiles
    where id = target_user_id and deleted_at is not null
  ) then
    raise exception 'account_already_deleted'
      using errcode = 'P0001';
  end if;

  -- Email synthétique unique par user — évite tout conflit avec un futur
  -- signup, et permet de retrouver l'user en DB si besoin (admin/forensics).
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
    notion_email        = null,
    username            = null,
    notion_member_page_id = null,
    deleted_at          = now()
  where id = target_user_id;

  -- 2. Swap l'email auth + nullifie le password + clean metadata + retire
  --    les identities OAuth. L'user ne peut plus se reconnecter (ni email,
  --    ni Google) — sa session courante reste valide jusqu'à expiration
  --    JWT, donc le Server Action appelle aussi signOut() après ça.
  update auth.users set
    email                = anonymized_email,
    encrypted_password   = null,
    email_confirmed_at   = null,
    phone                = null,
    phone_confirmed_at   = null,
    raw_user_meta_data   = '{}'::jsonb,
    raw_app_meta_data    = jsonb_build_object('providers', '[]'::jsonb)
  where id = target_user_id;

  -- 3. Supprime toutes les identities (email, google, etc.) — l'user ne
  --    peut plus du tout se reconnecter par aucun provider.
  delete from auth.identities
  where user_id = target_user_id;

  -- 4. Cleanup password_history (les hashes n'ont plus aucune valeur).
  delete from public.password_history
  where user_id = target_user_id;
end;
$$;

comment on function public.anonymize_account(uuid) is
  'Anonymise un compte (soft-delete) : nullifie les champs PII, swap email, retire identities. Appelée uniquement par deleteAccountAction après re-auth.';

-- ============================================================================
-- 3. Permissions sur la fonction
-- ============================================================================
-- Par défaut, les fonctions SECURITY DEFINER en public sont accessibles
-- au rôle `authenticated`. On NE l'autorise PAS — le Server Action doit
-- l'appeler via le service-role (admin client) pour garder le contrôle
-- côté code applicatif (vérification de l'identité, re-auth, etc.).
revoke execute on function public.anonymize_account(uuid) from public;
revoke execute on function public.anonymize_account(uuid) from authenticated;
revoke execute on function public.anonymize_account(uuid) from anon;
