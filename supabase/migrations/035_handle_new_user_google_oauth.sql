-- Migration 035 — handle_new_user : lecture des claims Google OAuth
--
-- Le trigger handle_new_user créé en migration 001 lisait uniquement les clés
-- `first_name` / `last_name` de raw_user_meta_data, qui sont celles qu'on
-- injecte nous-mêmes lors d'un signup email/password (signUpAction).
--
-- Quand un user signin via Google OAuth (signInWithGoogleAction → callback),
-- Supabase stocke automatiquement les claims du provider dans
-- raw_user_meta_data avec les clés suivantes :
--   - given_name   → prénom
--   - family_name  → nom
--   - name         → nom complet ("Jean Dupont")
--   - full_name    → idem (Supabase v2 le propose aussi)
--   - picture      → URL avatar Google
--   - avatar_url   → idem (Supabase v2 alias)
--   - email_verified
--
-- Résultat avant cette migration : tout user Google avait
--   first_name = NULL
--   last_name = NULL
--   full_name = split_part(email, '@', 1)  -- ex: "jdupont"
--   display_name = NULL
--   avatar_url = NULL  -- jamais peuplé même si Google fournit picture
--
-- Conséquence : copie cassée partout dans l'app ("Bonjour <username>" affichait
-- la partie locale de l'email au lieu du prénom), avatar absent dans la
-- communauté / messagerie, profiles incomplets pour le matching CRM.
--
-- Ce fix : on lit en CASCADE les clés possibles, prénom/nom email-password
-- d'abord (signup explicite), Google OAuth ensuite, fallback parse du
-- full_name en dernier recours. Avatar peuplé depuis picture/avatar_url quand
-- disponible.
--
-- Backfill : pas de users Google existants en base (vérifié — 0 row dans
-- auth.identities WHERE provider = 'google'). On ne touche donc pas aux users
-- email/password existants — leur first_name/last_name sont déjà cohérents.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_org_id        uuid;
  v_first_name    text;
  v_last_name     text;
  v_display_name  text;
  v_full_name     text;
  v_avatar_url    text;
  v_username_base text;
  v_username      text;
begin
  -- Résolution de l'organisation racine. En v0 codée en dur.
  select id into v_org_id
  from public.organizations
  where slug = 'notion-club';

  if v_org_id is null then
    raise exception 'Organisation racine introuvable (slug=notion-club). Lancer le seed.';
  end if;

  -- Prénom : signup form en priorité (first_name), puis Google (given_name).
  v_first_name := coalesce(
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'given_name', '')
  );

  -- Nom : signup form (last_name) puis Google (family_name).
  v_last_name := coalesce(
    nullif(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'family_name', '')
  );

  -- Nom complet : signup form (full_name) → Google (name/full_name) →
  -- recomposition prénom+nom → partie locale de l'email (fallback ultime).
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(trim(concat_ws(' ', v_first_name, v_last_name)), ''),
    split_part(new.email, '@', 1)
  );

  -- Si first_name/last_name encore vides mais qu'on a un full_name Google
  -- (cas "Jean Dupont" sans given/family), on parse le full_name.
  if v_first_name is null and v_full_name is not null and position(' ' in v_full_name) > 0 then
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name  := nullif(
      trim(substr(v_full_name, length(split_part(v_full_name, ' ', 1)) + 2)),
      ''
    );
  end if;

  -- display_name = prénom si dispo, sinon full_name (jamais NULL — la
  -- communauté/messagerie l'utilise pour l'affichage).
  v_display_name := coalesce(v_first_name, v_full_name);

  -- Avatar : Google fournit picture (claim officiel) ; Supabase v2 propose
  -- aussi avatar_url comme alias. On lit les 2.
  v_avatar_url := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'picture', '')
  );

  -- Username unique. Base = first_name si dispo, sinon partie locale email.
  v_username_base := coalesce(v_first_name, split_part(new.email, '@', 1));
  v_username := public.generate_unique_username(v_username_base);

  insert into public.profiles (
    id, organization_id,
    full_name, first_name, last_name, display_name, username, avatar_url
  )
  values (
    new.id, v_org_id,
    v_full_name, v_first_name, v_last_name, v_display_name, v_username, v_avatar_url
  );

  return new;
end;
$function$;
