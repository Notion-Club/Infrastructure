-- Migration 025 — Profils : visibilité same-org + seed profil admin manquant
--
-- Date    : 2026-06-02
-- Auteur  : Notion Club Infra
-- Module  : auth / community (visibilité du picker DM)
--
-- Pitch
-- -----
-- Deux problèmes adressés ensemble parce qu'ils décrivent le même symptôme
-- (NewConversationModal vide pour Nathan admin) et la même classe de fix
-- (alignement de la couche profiles avec la couche auth.users) :
--
-- A. Le compte auth.users id=53826b93-88b4-4be1-a52f-73ac1950b0fa
--    (nathangallaistest@gmail.com) n'avait pas de ligne dans public.profiles.
--    Le ProfileIdentityProvider tolère ce cas (`profile?` partout, fallback
--    "?" / "Invité"), donc le bug est resté silencieux. Mais côté DB :
--    current_profile_admin_org() renvoie NULL pour ce user → la policy
--    profiles_select_admin ne matche jamais → seul profiles_select_self
--    s'applique → cherche id = auth.uid() → 0 row puisque le profil n'existe
--    pas → listMembersAction retourne [].
--
-- B. Le picker DM est par essence cross-membre : tous les users d'une
--    même organisation Notion Club doivent pouvoir se voir entre eux pour
--    démarrer une conversation. Les policies actuelles le permettent
--    UNIQUEMENT pour les admins (profiles_select_admin). Un membre standard
--    (Théo, Virgile, etc.) ne voit que son propre profil — donc le picker
--    leur serait vide aussi. On ajoute une policy same-org dédiée.
--
-- ⚠️ Ticket Sensible — RLS
--   La nouvelle policy profiles_select_same_org étend la visibilité des
--   profils à tous les membres de la même organisation. C'est l'intention
--   métier (communauté unique Notion Club), mais ça expose des champs
--   comme `phone`, `bio`, `notion_email` à tous les pairs. Si ces champs
--   doivent rester privés, créer une vue publique ou stripper les colonnes
--   au mapping côté queries (mapProfileMember ne sélectionne déjà que
--   id/first_name/last_name/display_name/username/avatar_url, donc OK pour
--   le picker DM ; à auditer si d'autres call sites exposent + de champs).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. Backfill du profil Nathan admin manquant
-- ---------------------------------------------------------------------------
-- INSERT idempotent (ON CONFLICT DO NOTHING) — au cas où la ligne aurait
-- été créée entre temps via le handle_new_user trigger ou manuellement.
-- full_name dérivé du nom usuel ; first_name/last_name remplis pour que
-- computeDisplayName côté queries puisse les utiliser. role='admin' pour
-- que current_profile_admin_org() et current_profile_role() retournent
-- ses valeurs. organization_id pointé sur Notion Club (org existante).
--
-- Note (2026-06-11) : le INSERT VALUES original cassait si
-- l'auth.users id=53826b93-…  n'existait pas (FK profiles_id_fkey →
-- auth.users). Sur prod ce user existe via signup ; sur les Supabase
-- preview/fresh DB il n'existait pas → migration bloquée. On bascule
-- en INSERT … SELECT … WHERE EXISTS pour rendre le backfill purement
-- défensif : aucun effet si l'auth user est absent.
insert into public.profiles (
  id,
  organization_id,
  full_name,
  first_name,
  last_name,
  username,
  role,
  email_verified_at
)
select
  '53826b93-88b4-4be1-a52f-73ac1950b0fa'::uuid,
  'f14b4169-5c78-42aa-99a6-7abcb8fc3f78'::uuid,
  'Nathan Gallais',
  'Nathan',
  'Gallais',
  'nathan-admin',
  'admin',
  now()
where exists (
  select 1 from auth.users
  where id = '53826b93-88b4-4be1-a52f-73ac1950b0fa'::uuid
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- B. Policy profiles_select_same_org
-- ---------------------------------------------------------------------------
-- Visibilité cross-membre dans une même organisation. Sans cette policy,
-- un member ne voit que son propre profil (profiles_select_self) — donc
-- le picker DM serait vide pour tous les non-admins.
--
-- Helper public.current_profile_org() : variante simplifiée de
-- current_profile_admin_org() sans le filtre role='admin'. SECURITY DEFINER
-- pour bypass la RLS lors de l'appel récursif sur public.profiles dans la
-- policy (sinon récursion infinie : la policy lit profiles → policy → ...).
--
-- search_path = public car la fonction est appelée depuis une policy,
-- donc on contrôle explicitement le namespace pour la sécurité.
create or replace function public.current_profile_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = (select auth.uid());
$$;

revoke all on function public.current_profile_org() from public;
grant execute on function public.current_profile_org() to authenticated;

comment on function public.current_profile_org() is
  'Renvoie l''organization_id du caller. SECURITY DEFINER pour éviter la '
  'récursion RLS sur profiles. Utilisé par profiles_select_same_org.';

-- La policy n'a PAS de WITH CHECK : pas de droit d'écriture ajouté.
-- INSERT/UPDATE/DELETE restent gérés par les policies existantes (self / admin).
drop policy if exists profiles_select_same_org on public.profiles;
create policy profiles_select_same_org
  on public.profiles
  for select
  to authenticated
  using (organization_id = public.current_profile_org());

comment on policy profiles_select_same_org on public.profiles is
  'Visibilité cross-membre : tout user authentifié voit les profils de sa propre '
  'organisation. Permet le picker DM (NewConversationModal) et la résolution '
  'd''auteurs/mentions dans le module community. Complète profiles_select_self '
  '(propre profil) et profiles_select_admin (admins voient leur org via le '
  'helper SECURITY DEFINER current_profile_admin_org).';

commit;
