-- Migration 026 — Hotfix RLS posts INSERT/UPDATE : admin/mentor bypass capability
--
-- Date    : 2026-06-02
-- Auteur  : Notion Club Infra
-- Module  : community
--
-- Pitch
-- -----
-- La migration 021 a posé posts_insert_with_guard et posts_update_with_guard
-- avec le prérequis `can_view_community` placé **en tête** du WITH CHECK,
-- AVANT le branchement admin/mentor. Conséquence : même un admin doit avoir
-- la capability can_view_community pour publier, ce qui contredit l'intention
-- documentée dans la migration 021 (cf. fix #2 safety appliqué côté SELECT
-- mais oublié côté INSERT/UPDATE).
--
-- Symptôme constaté en prod : tous les utilisateurs (admins compris) voient
-- "new row violates row-level security policy for table 'posts'" au moment
-- de publier. Les memberships actives existantes sont sur l'offre "Challenge
-- Gratuit" qui n'accorde pas can_view_community ; les admins (Nathan, Théo)
-- n'ont pas de membership active ni cette capability.
--
-- Fix : on aligne INSERT/UPDATE sur le pattern SELECT de la mig. 021 — le
-- court-circuit admin/mentor passe AVANT le check capability. La logique
-- métier reste identique pour les membres standard.
--
-- Pas de WITH CHECK qui change pour les autres rôles : tag/audience/pinned
-- restent bridés pour les membres standard.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) INSERT — posts_insert_with_guard (réécriture avec court-circuit admin)
-- ---------------------------------------------------------------------------

drop policy if exists posts_insert_with_guard on public.posts;

create policy posts_insert_with_guard
  on public.posts
  for insert
  to authenticated
  with check (
    -- Auth de base : l'auteur c'est moi. Pas d'usurpation possible quel
    -- que soit le rôle.
    author_id = (select auth.uid())

    and (
      -- Branche 1 : admin / mentor → bypass total du prérequis capability
      -- (cohérent avec la policy SELECT two-silo qui fait le même
      -- court-circuit). Un admin sans abonnement actif doit pouvoir
      -- modérer / publier des annonces sans avoir à se payer Accompagnement.
      (select public.current_profile_role()) in ('admin', 'mentor')

      or (
        -- Branche 2 : membre standard → prérequis capability + bridage
        -- des champs éditoriaux.
        (select public.user_has_capability((select auth.uid()), 'can_view_community'))
        and (tag is null or tag <> 'annonce')
        and audience = 'all'
        and coalesce(pinned, false) = false
        and pinned_until is null
      )
    )
  );

comment on policy posts_insert_with_guard on public.posts is
  'INSERT garde-fou v2 (mig. 026) : author_id = auth.uid() + (admin/mentor '
  'bypass complet OR membre standard avec capability can_view_community + '
  'tag<>annonce + audience=all + pinned=false). author_tier verrouillé par '
  'le trigger posts_guard_author_tier_bu (mig. 020).';

-- ---------------------------------------------------------------------------
-- 2) UPDATE — posts_update_with_guard (même alignement)
-- ---------------------------------------------------------------------------

drop policy if exists posts_update_with_guard on public.posts;

create policy posts_update_with_guard
  on public.posts
  for update
  to authenticated
  using (
    -- USING : qui peut toucher cette ligne ?
    -- → l'auteur du post, ou un admin/mentor (modération transverse).
    author_id = (select auth.uid())
    or (select public.current_profile_role()) in ('admin', 'mentor')
  )
  with check (
    -- WITH CHECK : que doit valoir la ligne APRÈS l'update ?
    (
      author_id = (select auth.uid())
      or (select public.current_profile_role()) in ('admin', 'mentor')
    )
    and (
      -- Admin / mentor : aucun bridage éditorial, peuvent tout faire.
      (select public.current_profile_role()) in ('admin', 'mentor')

      or (
        -- Membre standard : anti-élévation symétrique à l'INSERT, plus
        -- check capability (cohérent avec l'INSERT).
        (select public.user_has_capability((select auth.uid()), 'can_view_community'))
        and (tag is null or tag <> 'annonce')
        and audience = 'all'
        and coalesce(pinned, false) = false
        and pinned_until is null
      )
    )
  );

comment on policy posts_update_with_guard on public.posts is
  'UPDATE garde-fou v2 (mig. 026) : USING auteur OU admin/mentor ; WITH CHECK '
  'admin/mentor bypass total OR membre standard avec capability et bridage '
  'symétrique à l''INSERT. Limitation legacy posts non conformes (cf. mig. 021) '
  'conservée.';

commit;
