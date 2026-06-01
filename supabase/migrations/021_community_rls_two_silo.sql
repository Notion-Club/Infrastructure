-- ============================================================================
-- Migration 021 — RLS posts two-silo (date : 2026-06-02)
-- ----------------------------------------------------------------------------
-- Objectif global
--
-- Reecrire les policies RLS de public.posts pour materialiser le cloisonnement
-- "two-silo" (free <-> free, paid <-> paid) introduit par la colonne
-- posts.author_tier (migration 020), tout en empechant un membre standard
-- d'usurper une voix editoriale reservee aux admins/mentors (tag='annonce',
-- audience='paid_only'/'free_only', epinglage).
--
-- Trois axes :
--   1. SELECT  : nouvelle policy posts_select_two_silo (remplace
--                posts_select_community), avec branche admin/mentor en
--                court-circuit, branche auteur (rattrapage post-bascule de
--                tier), branche pinned (annonces transverses) et branche
--                two-silo classique cadree par audience.
--   2. INSERT  : nouvelle policy posts_insert_with_guard (remplace
--                posts_insert_self_or_admin), qui bride les champs
--                editoriaux pour les membres standard.
--   3. UPDATE  : nouvelle policy posts_update_with_guard (remplace
--                posts_update_author_or_admin), symetrique a l'INSERT,
--                anti-elevation de privilege.
--
-- Helpers utilises (deja en place, audites) :
--   - public.user_has_capability(uuid, text)  -> migrations 003 + 013
--     SECURITY DEFINER, STABLE, search_path=public, whitelist hardcoded.
--   - public.current_profile_role()           -> migration 014
--     SECURITY DEFINER, STABLE, search_path=public, seul helper qui couvre
--     a la fois 'admin' ET 'mentor' sans risque de recursion sur profiles.
--
-- Pas de policy service_role : Supabase bypass naturellement la RLS pour les
-- appels server-side prives (cron, webhooks, jobs Notion sync).
--
-- ----------------------------------------------------------------------------
-- Fixes integres depuis l'audit adversarial
--
--   [#1 safety / #1 completeness] La colonne s'appelle bien `pinned` (cf.
--     migration 014 ligne 52 : `pinned boolean not null default false`).
--     Aucune occurrence de `is_pinned` ne subsiste dans cette migration.
--
--   [#2 safety] La branche admin/mentor du SELECT court-circuite desormais
--     le prerequis can_view_community. Un admin ou mentor sans abonnement
--     actif doit pouvoir moderer le feed, point. Le prerequis capability
--     n'est applique qu'aux branches "membre standard" (auteur, pinned,
--     two-silo).
--
--   [#3 completeness] `pinned` est NOT NULL DEFAULT false en DB (migration
--     014), donc `pinned = false` est sur. On ecrit malgre tout
--     `coalesce(pinned, false) = false` par defense en profondeur — au cas
--     ou une future migration relacherait la contrainte.
--
--   [#4 completeness / #4 safety] author_tier est deja verrouille par le
--     trigger posts_guard_author_tier_bu (migration 020). On n'ajoute pas
--     de check RLS supplementaire : le trigger BEFORE est la barriere
--     canonique pour ce champ (impossible d'ecrire/modifier author_tier
--     depuis l'app). On evite ainsi la duplication de logique.
--
--   [#5 safety] Risque d'invalider les UPDATE retroactifs sur posts legacy
--     non conformes (ex : un post `audience='paid_only'` cree avant 021 par
--     un membre standard). Mitigation : la migration 020 a deja realigne
--     les posts existants sur les regles two-silo (backfill author_tier),
--     et avant 021, un membre standard ne pouvait pas ecrire `paid_only`
--     car ce champ existait deja mais etait filtre cote app. Le risque
--     residuel est marginal. On documente la limitation dans le commentaire
--     de policy plutot que de migrer vers un trigger BEFORE UPDATE — la
--     dette d'un trigger supplementaire n'est pas justifiee ici.
--
--   [#5 completeness] DELETE non touche volontairement — la policy
--     posts_delete_author_or_admin de la migration 014 reste pertinente
--     (auteur ou admin/mentor). Verifie : un membre standard ne peut pas
--     supprimer un post epingle car il n'en est pas l'auteur (un post
--     epingle est forcement publie par admin/mentor sous la nouvelle
--     regle INSERT). RAS.
--
--   [#4 safety, #6/#7/#8/#9/#10 safety] RAS (faux positifs ou intention
--     conforme), aucun changement requis.
--
-- ----------------------------------------------------------------------------
-- Note performance
--
-- user_has_capability et current_profile_role sont SECURITY DEFINER + STABLE.
-- On les enveloppe dans `(select ...)` scalaire pour que le planner les
-- cache en init-plan (pattern Supabase recommande, identique a
-- `(select auth.uid())`). Chaque helper est ainsi resolu une seule fois par
-- requete, pas par ligne.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) SELECT — posts_select_two_silo
-- ----------------------------------------------------------------------------

drop policy if exists posts_select_community on public.posts;

create policy posts_select_two_silo
  on public.posts
  for select
  to authenticated
  using (
    -- Branche 1 : admin / mentor → vue exhaustive (moderation + annonces).
    -- Court-circuite le prerequis can_view_community : un admin sans
    -- abonnement actif doit pouvoir moderer le feed quand meme.
    (select public.current_profile_role()) in ('admin', 'mentor')

    or (
      -- Prerequis transverse pour les non-admins/non-mentors : sans
      -- capability community (abonnement actif), on ne voit rien.
      (select public.user_has_capability((select auth.uid()), 'can_view_community'))
      and (
        -- Branche 2 : l'auteur voit toujours ses propres posts, meme si
        -- son tier a bascule entre la creation et le SELECT (paid → free
        -- apres expiration d'abo, par exemple).
        author_id = (select auth.uid())

        -- Branche 3 : les posts epingles sont des annonces generales,
        -- visibles des deux silos sans condition de tier ni d'audience.
        -- coalesce defensif : si une future migration rendait `pinned`
        -- nullable, on traite NULL comme false.
        or coalesce(pinned, false) = true

        -- Branche 4 : two-silo classique. Le viewer voit les posts dont
        -- l'auteur partage son tier ET dont l'audience l'autorise.
        or (
          -- Resolution du tier viewer une seule fois (init-plan cache).
          -- viewer_tier = 'paid' si can_view_paid_content, sinon 'free'.
          author_tier = case
            when (select public.user_has_capability((select auth.uid()), 'can_view_paid_content'))
              then 'paid'
            else 'free'
          end
          and (
            -- audience='all' : visible dans le silo du viewer.
            audience = 'all'

            -- audience='free_only' : reserve au silo free.
            -- (author_tier='free' deja garanti par l'egalite ci-dessus,
            -- on verrouille explicitement pour lisibilite.)
            or (
              audience = 'free_only'
              and author_tier = 'free'
            )

            -- audience='paid_only' : reserve au silo paid.
            -- (author_tier='paid' deja garanti, idem verrou explicite.)
            or (
              audience = 'paid_only'
              and author_tier = 'paid'
            )
          )
        )
      )
    )
  );

comment on policy posts_select_two_silo on public.posts is
  'SELECT two-silo : admin/mentor voient tout (sans prerequis capability), sinon prerequis can_view_community puis (auteur de la ligne OR post epingle OR cloisonnement strict free<->free / paid<->paid via posts.author_tier croise avec audience all/free_only/paid_only).';

-- ----------------------------------------------------------------------------
-- 2) INSERT — posts_insert_with_guard
-- ----------------------------------------------------------------------------
-- Empeche un membre standard de publier un post avec des attributs reserves
-- aux admins / mentors :
--   * tag = 'annonce'          → reservee a la voix editoriale admin/mentor
--   * audience = 'paid_only'   → ciblage payant = acte editorial
--   * audience = 'free_only'   → silo derive du tier auteur cote app
--   * pinned = true            → epinglage = decision de moderation
--   * pinned_until non NULL    → meme logique, champ de moderation
--
-- author_tier n'est pas verrouille ici : le trigger posts_guard_author_tier_bu
-- (migration 020) impose deja la valeur derivee du tier de l'auteur. Ajouter
-- un check RLS dupliquerait la logique inutilement.
-- ----------------------------------------------------------------------------

drop policy if exists posts_insert_self_or_admin on public.posts;

create policy posts_insert_with_guard
  on public.posts
  for insert
  to authenticated
  with check (
    -- Prerequis inchange : il faut la capability d'acces a la communaute.
    (select public.user_has_capability((select auth.uid()), 'can_view_community'))

    -- L'auteur du post, c'est forcement moi (pas d'usurpation possible).
    and author_id = (select auth.uid())

    and (
      -- Admin / mentor : aucune restriction sur les champs editoriaux.
      (select public.current_profile_role()) in ('admin', 'mentor')

      or (
        -- Membre standard : tag 'annonce' interdit (reservee voix editoriale).
        -- Le test `tag is null` reste defensif au cas ou la contrainte
        -- NOT NULL serait relachee — aujourd'hui le NOT NULL table-level
        -- tranche avant la policy de toute facon.
        (tag is null or tag <> 'annonce')

        -- Membre standard : audience forcee a 'all' (les silos free/paid
        -- sont derives du tier auteur cote front, pas choisis manuellement).
        and audience = 'all'

        -- Membre standard : epinglage interdit (acte de moderation).
        -- coalesce defensif au cas ou pinned deviendrait nullable.
        and coalesce(pinned, false) = false

        -- Membre standard : pas de date d'epinglage non plus.
        and pinned_until is null
      )
    )
  );

comment on policy posts_insert_with_guard on public.posts is
  'INSERT garde-fou : capability community + author_id = auth.uid(). Membre standard bride sur tag<>annonce, audience=all, pinned=false, pinned_until=null. Admin/mentor : aucun bridage editorial. author_tier verrouille par trigger posts_guard_author_tier_bu (migration 020), pas par cette policy.';

-- ----------------------------------------------------------------------------
-- 3) UPDATE — posts_update_with_guard
-- ----------------------------------------------------------------------------
-- WITH CHECK symetrique a l'INSERT, anti-elevation de privilege sur un post
-- deja possede par un membre standard.
--
-- Limitation connue (cf. audit safety #5) : si un post legacy d'un membre
-- standard a un champ editorial deja non conforme (ex audience='paid_only'
-- pre-021), tout UPDATE par l'auteur sera rejete. Les policies RLS n'ont
-- pas acces a OLD/NEW. Cas suppose marginal vu le backfill 020 et le
-- filtrage cote app pre-021. On accepte cette limitation plutot que
-- d'ajouter un trigger BEFORE UPDATE.
-- ----------------------------------------------------------------------------

drop policy if exists posts_update_author_or_admin on public.posts;

create policy posts_update_with_guard
  on public.posts
  for update
  to authenticated
  using (
    -- USING : qui a le droit de toucher cette ligne ?
    -- → l'auteur du post, ou un admin/mentor (moderation transversale).
    author_id = (select auth.uid())
    or (select public.current_profile_role()) in ('admin', 'mentor')
  )
  with check (
    -- WITH CHECK : que doit valoir la ligne APRES l'update ?
    -- L'auteur ne peut pas etre reassigne a quelqu'un d'autre
    -- (sauf admin/mentor qui peut tout faire).
    (
      author_id = (select auth.uid())
      or (select public.current_profile_role()) in ('admin', 'mentor')
    )
    and (
      -- Admin / mentor : peuvent tout faire (epingler, taguer 'annonce', etc.).
      (select public.current_profile_role()) in ('admin', 'mentor')

      or (
        -- Membre standard sur son propre post : ne peut PAS s'auto-promouvoir
        -- en se taguant 'annonce', en passant son post en paid_only/free_only,
        -- ni en s'epinglant lui-meme. Verrou anti-elevation de privilege,
        -- strictement symetrique aux regles d'INSERT.
        (tag is null or tag <> 'annonce')
        and audience = 'all'
        and coalesce(pinned, false) = false
        and pinned_until is null
      )
    )
  );

comment on policy posts_update_with_guard on public.posts is
  'UPDATE garde-fou symetrique a l''INSERT : USING autorise auteur OU admin/mentor ; WITH CHECK empeche un membre standard de s''auto-promouvoir (tag annonce, audience paid_only/free_only, pinned, pinned_until). Admin/mentor : aucun bridage. Limitation : posts legacy non conformes peuvent etre verrouilles en edition (acceptee).';

commit;
