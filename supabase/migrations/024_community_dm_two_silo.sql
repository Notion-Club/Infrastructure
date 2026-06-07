-- Migration 024 — Brique Community — RLS DM two-silo
--
-- Date    : 2026-06-02
-- Auteur  : Notion Club Infra
-- Module  : community (DM 1-1)
--
-- Pitch
-- -----
-- La règle métier `canDMUser` (src/modules/community/utils/dm-rules.ts) dit :
--
--   - admins/mentors ↔ tout le monde (passerelle / SAV)
--   - sinon : viewer.offer === target.offer (silo strict free↔free, paid↔paid)
--
-- Jusqu'ici cette règle était filtrée UNIQUEMENT côté UI (NewConversationModal
-- liste les targets éligibles). Un client malicieux pouvait bypasser et créer
-- une conversation entre 2 silos différents en POSTant directement sur Supabase.
--
-- On porte cette règle au niveau RLS via une réécriture de la policy
-- conversations_insert_self. La policy SELECT reste inchangée (participant
-- voit toujours sa conv, même si la règle two-silo a changé après création).
--
-- Helpers réutilisés (déjà en place) :
--   - public.user_has_capability(uuid, text)  — capability lookup
--   - public.current_profile_role()           — admin/mentor passe-droit
--
-- ⚠️ Ticket Sensible
-- L'helper user_has_capability est appelé sur BOTH participants. Performance
-- acceptable car INSERT rare (par essence un seul SELECT supplémentaire).
-- =============================================================================

begin;

drop policy if exists conversations_insert_self on public.conversations;

create policy conversations_insert_with_two_silo
  on public.conversations
  for insert
  to authenticated
  with check (
    -- 1) Auth : le caller doit être l'un des deux participants
    (
      participant_a_id = (select auth.uid())
      or participant_b_id = (select auth.uid())
    )
    and (
      -- 2) Admin/mentor passe-droit : si caller OU target est admin/mentor,
      --    la règle two-silo ne s'applique pas (SAV, modération, etc.)
      (select public.current_profile_role()) in ('admin', 'mentor')

      -- Ou si l'autre participant (target) est admin/mentor.
      -- On regarde le rôle stocké directement sur profiles plutôt que de
      -- réutiliser current_profile_role (qui se base sur auth.uid()).
      or exists (
        select 1 from public.profiles p
        where p.id = case
          when participant_a_id = (select auth.uid()) then participant_b_id
          else participant_a_id
        end
        and p.role in ('admin', 'mentor')
      )

      -- 3) Sinon, two-silo strict : le tier de l'auteur (caller) doit
      --    matcher celui du target. On utilise can_view_paid_content comme
      --    proxy de "tier paid", consistent avec la convention posts.author_tier.
      or (
        (select public.user_has_capability((select auth.uid()), 'can_view_paid_content'))
        = (select public.user_has_capability(
            case
              when participant_a_id = (select auth.uid()) then participant_b_id
              else participant_a_id
            end,
            'can_view_paid_content'
          ))
      )
    )
  );

comment on policy conversations_insert_with_two_silo on public.conversations is
  'INSERT two-silo : caller doit être l''un des deux participants ET '
  '(caller ou target est admin/mentor OR les deux ont le même tier paid). '
  'Garde-fou serveur en complément de canDMUser côté UI (dm-rules.ts).';

commit;
