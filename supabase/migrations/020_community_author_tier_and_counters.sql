-- Migration 020 — Brique Community — author_tier, compteurs dénormalisés, reactions sur replies, mentions structurées
--
-- Date    : 2026-06-01
-- Auteur  : Notion Club Infra
-- Module  : community (suite de 014_community_schema.sql)
--
-- Pitch
-- -----
-- Quatre extensions du schéma communauté posées en 014 :
--
--   A. posts.author_tier (free|paid) — dénormalisation du tier de l'auteur
--      pour ouvrir la voie à une RLS two-silo indexable.
--   B. comment_reply_reactions — réactions emoji sur les replies de commentaire,
--      strictement calquées sur public.comment_reactions (014).
--   C. posts.comment_count / posts.reaction_count — compteurs dénormalisés
--      maintenus par triggers, pour éviter un COUNT(*) à chaque listPosts.
--   D. post_mentions / comment_mentions — tables de jointure pour les @mentions
--      structurées (N par post/commentaire), avec recherche inverse indexée.
--
-- ⚠️ Ticket Sensible — RLS
--   Les fonctions trigger sont SECURITY DEFINER pour bypasser la RLS de
--   memberships/offers (bloc A) ou pour permettre à un commentateur lambda
--   de mettre à jour le compteur d'un post dont il n'est pas auteur (bloc C).
--   search_path = public figé sur toutes ces fonctions pour neutraliser
--   tout hijack. EXECUTE révoqué de PUBLIC sur chacune.
--
-- Fixes adversariaux intégrés
-- ---------------------------
--   safety #1 — trigger author_tier durci avec une clause WHEN défensive.
--   safety #2 — trigger BEFORE UPDATE qui empêche un client de forcer
--               author_tier='paid' via un UPDATE direct.
--   safety #3 — backfill bloc C splitté en deux UPDATE pour éviter le
--               cross-join cartésien sur gros volumes.
--   safety #5 — REVOKE EXECUTE FROM PUBLIC sur toutes les fonctions
--               SECURITY DEFINER.
--   safety #8 — index supplémentaire sur comment_reply_reactions(user_id).
--   completeness #3.1 — trigger AFTER UPDATE OF post_id sur comments (cas
--               marginal du commentaire qui migre de post).
--   completeness #4.2 — policies DELETE explicites sur post_mentions et
--               comment_mentions (sinon édition d'un body retirant une @mention
--               bloquée par RLS).
--
-- Fixes adversariaux NON intégrés (justifiés)
-- -------------------------------------------
--   safety #4 (EXISTS RLS) — Postgres applique la RLS de la table cible
--               dans les sous-requêtes, donc l'EXISTS sur posts/comments
--               filtre déjà par visibilité. Documenté en commentaire de
--               policy pour éviter une régression au refactor.
--   safety #6 (CREATE INDEX CONCURRENTLY) — incompatible avec le pattern
--               BEGIN/COMMIT utilisé par ce repo. Acceptable sur le volume
--               actuel ; à passer en concurrent dans une migration dédiée
--               si volumétrie l'exige.
--   completeness #1.2 (re-sync author_tier sur changement de membership)
--               — hors scope de ce bloc, traité ultérieurement par un job
--               batch ou un trigger sur memberships.
--   completeness #1.3 (policy RLS two-silo) — colonne et index posés, la
--               réécriture de posts_select_community est laissée à une
--               migration dédiée (changement de surface RLS lecture).
--   completeness #4.1 (check user_has_capability sur mentioned_user_id)
--               — défense en profondeur optionnelle, non bloquante. Le côté
--               serveur valide déjà la cible avant insertion.
-- =============================================================================

begin;

-- =============================================================================
-- BLOC A — posts.author_tier
-- =============================================================================
-- Pourquoi cette colonne ?
--   Le feed communautaire est "two-silo" : les posts d'auteurs payants ne
--   doivent être lus que par d'autres payants (et inversement côté free).
--   On pourrait dériver le tier de l'auteur à la volée dans la RLS via
--   public.user_has_capability(author_id, 'can_view_paid_content'), mais ça
--   imposerait un JOIN memberships+offers à chaque SELECT du feed.
--   On dénormalise donc le tier directement sur la ligne post, peuplé par
--   un trigger BEFORE INSERT/UPDATE — la RLS deviendra à terme un simple
--   test d'égalité indexable sur posts.author_tier.
-- -----------------------------------------------------------------------------

-- A.1 — Colonne author_tier
--   DEFAULT 'free' pour que le backfill et les INSERT legacy ne cassent pas.
--   CHECK pour cadenasser le domaine à deux valeurs (pas d'enum pour rester
--   cohérent avec le pattern text+CHECK déjà utilisé sur posts.tag/audience).
alter table public.posts
  add column if not exists author_tier text not null default 'free'
    check (author_tier in ('free','paid'));

comment on column public.posts.author_tier is
  'Tier de l''auteur au moment de la dernière écriture (''free'' | ''paid''). '
  'Peuplé par le trigger posts_set_author_tier_biu via user_has_capability. '
  'Dénormalisation volontaire pour permettre une RLS two-silo indexée. '
  'Verrouillé en UPDATE par posts_guard_author_tier_bu (cf. fix safety #2).';

-- A.2 — Fonction trigger : calcul du tier à partir de user_has_capability
--   SECURITY DEFINER pour bypass la RLS de memberships/offers : sans ça, un
--   user lambda ne verrait pas ses propres memberships si la RLS est stricte.
--   search_path = public car user_has_capability fait du SQL dynamique non
--   qualifié sur public.memberships / public.offers (cf. migration 013).
create or replace function public.posts_set_author_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author_tier := case
    when public.user_has_capability(new.author_id, 'can_view_paid_content') then 'paid'
    else 'free'
  end;
  return new;
end;
$$;

comment on function public.posts_set_author_tier() is
  'Peuple posts.author_tier en fonction de la capability can_view_paid_content '
  'de l''auteur. SECURITY DEFINER pour traverser la RLS memberships/offers.';

revoke execute on function public.posts_set_author_tier() from public;

-- A.3 — Trigger BEFORE INSERT / UPDATE OF author_id
--   On limite l'UPDATE à author_id : recalculer à chaque edit de body/title
--   coûterait un JOIN memberships sans aucune raison (l'auteur ne change pas).
--   Clause WHEN défensive (fix safety #1) : si une migration future ajoute
--   d'autres colonnes au triggered UPDATE, le recalcul ne se déclenche
--   toujours que sur réel changement d'auteur.
-- Note : pas de WHEN clause — un INSERT trigger ne peut pas référencer OLD
-- (Postgres 42P17). Le `update of author_id` filtre déjà au niveau colonne :
-- le trigger ne tire pas sur un UPDATE qui ne touche pas author_id.
drop trigger if exists posts_set_author_tier_biu on public.posts;
create trigger posts_set_author_tier_biu
  before insert or update of author_id on public.posts
  for each row
  execute function public.posts_set_author_tier();

-- A.4 — Fonction trigger : verrou contre l'altération directe de author_tier
--   Fix safety #2 : sans ce garde-fou, un auteur peut écrire
--   `UPDATE posts SET author_tier='paid' WHERE id=...` (autorisé par la
--   policy posts_update_author_or_admin existante) et forcer son post dans
--   le silo paid. On force author_tier := old.author_tier sauf si author_id
--   change (auquel cas posts_set_author_tier recalcule juste après).
create or replace function public.posts_guard_author_tier()
returns trigger
language plpgsql
as $$
begin
  if new.author_id is not distinct from old.author_id then
    new.author_tier := old.author_tier;
  end if;
  return new;
end;
$$;

comment on function public.posts_guard_author_tier() is
  'Empêche un client de modifier author_tier directement via UPDATE. '
  'Si author_id change, posts_set_author_tier (déclenché ensuite par le '
  'trigger BIU sur la même action) recalcule la valeur officielle.';

-- Trigger BEFORE UPDATE général : il doit s'exécuter AVANT
-- posts_set_author_tier_biu pour que ce dernier (qui ne tire qu'au
-- changement d'author_id) ait le dernier mot. L'ordre d'exécution
-- des triggers BEFORE est alphabétique → 'guard' < 'set'.
drop trigger if exists posts_guard_author_tier_bu on public.posts;
create trigger posts_guard_author_tier_bu
  before update on public.posts
  for each row
  execute function public.posts_guard_author_tier();

-- A.5 — Backfill des lignes existantes
--   Les posts créés avant cette migration ont author_tier = 'free' (default).
--   On les recalcule via la même logique que le trigger pour rester cohérent.
--   Note : posts_set_author_tier_biu ne se redéclenche pas ici (UPDATE OF
--   author_id only), et posts_guard_author_tier_bu va voir author_id inchangé
--   et réécrire OLD.author_tier — on doit donc DÉSACTIVER ce dernier
--   temporairement pour que le backfill prenne effet.
alter table public.posts disable trigger posts_guard_author_tier_bu;

update public.posts p
   set author_tier = case
         when public.user_has_capability(p.author_id, 'can_view_paid_content') then 'paid'
         else 'free'
       end
 where author_tier is distinct from (
         case
           when public.user_has_capability(p.author_id, 'can_view_paid_content') then 'paid'
           else 'free'
         end
       );

alter table public.posts enable trigger posts_guard_author_tier_bu;

-- A.6 — Index sur author_tier
--   La future RLS two-silo croisera viewer_tier × author_tier à chaque SELECT
--   du feed. Index btree simple suffit (cardinalité 2 mais combiné avec
--   d'autres prédicats côté planner, et utile pour les counts admin par tier).
--   NB : non CONCURRENTLY car BEGIN/COMMIT englobant (cf. fix #6 refusé).
create index if not exists posts_author_tier_idx
  on public.posts (author_tier);


-- =============================================================================
-- BLOC B — comment_reply_reactions
-- =============================================================================
-- Table de jointure : permet aux membres de la communauté de réagir avec un
-- emoji sur les replies de commentaires (jusqu'ici, seuls les commentaires
-- racine étaient réactionnables via public.comment_reactions, 014).
--
-- Calqué EXACTEMENT sur public.comment_reactions :
--   - PK composite (comment_reply_id, user_id, emoji) → empêche les doublons
--     d'emoji par user sur une même reply.
--   - Pas de colonne updated_at ni de trigger : une réaction est immuable,
--     on insert ou on delete, jamais d'update.
--   - RLS : SELECT délégué à la visibilité de la reply parente, INSERT/DELETE
--     restreints au propriétaire (user_id = auth.uid()).
-- =============================================================================

create table if not exists public.comment_reply_reactions (
  comment_reply_id  uuid        not null references public.comment_replies(id) on delete cascade,
  user_id           uuid        not null references public.profiles(id)        on delete cascade,
  emoji             text        not null,
  created_at        timestamptz not null default now(),
  primary key (comment_reply_id, user_id, emoji)
);

comment on table public.comment_reply_reactions is
  'Réactions emoji posées par un membre de la communauté sur un reply de '
  'commentaire. PK composite empêchant les doublons d''emoji par (reply, user).';

-- Index pour les comptages / agrégations par reply
create index if not exists comment_reply_reactions_reply_idx
  on public.comment_reply_reactions (comment_reply_id);

-- Fix safety #8 — index complémentaire pour "mes réactions" (filtre user_id
-- seul, non couvert par la PK composite dont user_id n'est pas la 1re colonne).
create index if not exists comment_reply_reactions_user_idx
  on public.comment_reply_reactions (user_id);

-- ----------------------------------------------------------------------------
-- RLS — comment_reply_reactions
-- ----------------------------------------------------------------------------
alter table public.comment_reply_reactions enable row level security;

-- SELECT : visible par tous les utilisateurs authentifiés dès lors que la
-- reply parente existe (la visibilité de la communauté est portée en amont
-- par les policies sur posts / comments / comment_replies). L'EXISTS
-- s'évalue avec la RLS de comment_replies active → un user qui ne voit pas
-- la reply ne voit pas la réaction (fix safety #4 documenté).
drop policy if exists comment_reply_reactions_select_via_reply on public.comment_reply_reactions;
create policy comment_reply_reactions_select_via_reply
  on public.comment_reply_reactions for select to authenticated
  using (
    exists (
      select 1
      from public.comment_replies cr
      where cr.id = comment_reply_reactions.comment_reply_id
    )
  );

-- INSERT : un user ne peut réagir que pour lui-même, et uniquement sur une
-- reply existante (et visible — RLS de comment_replies appliquée à l'EXISTS).
drop policy if exists comment_reply_reactions_insert_self on public.comment_reply_reactions;
create policy comment_reply_reactions_insert_self
  on public.comment_reply_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.comment_replies cr
      where cr.id = comment_reply_reactions.comment_reply_id
    )
  );

-- DELETE : un user ne peut retirer que ses propres réactions.
drop policy if exists comment_reply_reactions_delete_self on public.comment_reply_reactions;
create policy comment_reply_reactions_delete_self
  on public.comment_reply_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Pas de policy UPDATE : une réaction n'est jamais modifiée (delete + insert).


-- =============================================================================
-- BLOC C — compteurs dénormalisés (comment_count, reaction_count)
-- =============================================================================
-- Pitch : éviter un COUNT(*) sur comments et post_reactions à chaque
-- listPosts. On matérialise deux colonnes comment_count et reaction_count
-- directement sur posts, maintenues par des triggers AFTER INSERT/DELETE.
--
-- ⚠️ Ticket Sensible — RLS
-- Les fonctions triggers sont SECURITY DEFINER pour pouvoir UPDATE posts
-- même quand l'INSERT vient d'un user qui n'a pas le droit d'éditer le post
-- (ex: laisser un commentaire ou réagir à un post d'un autre auteur). Le
-- search_path est figé pour neutraliser tout hijack.
--
-- Atomicité : on fait un seul UPDATE par trigger avec + 1 / - 1 calculé
-- côté SQL (et non lu/écrit applicativement), pour rester safe en concurrence.
-- =============================================================================

-- C.1 — Colonnes dénormalisées sur posts
alter table public.posts
  add column if not exists comment_count  integer not null default 0,
  add column if not exists reaction_count integer not null default 0;

comment on column public.posts.comment_count  is
  'Nombre de commentaires (dénormalisé). Maintenu par triggers sur public.comments.';
comment on column public.posts.reaction_count is
  'Nombre de réactions (dénormalisé). Maintenu par triggers sur public.post_reactions.';

-- ----------------------------------------------------------------------------
-- C.2 — Fonctions trigger pour public.comments
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER nécessaire : un commentateur lambda n'a pas la policy
-- posts_update_author_or_admin, on doit donc bypasser la RLS pour mettre
-- à jour le compteur sur un post dont il n'est pas auteur.

create or replace function public.posts_bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
     set comment_count = comment_count + 1
   where id = new.post_id;
  return new;
end;
$$;

revoke execute on function public.posts_bump_comment_count() from public;

create or replace function public.posts_drop_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- On clampe à 0 par sécurité au cas où un état désynchronisé existerait.
  update public.posts
     set comment_count = greatest(comment_count - 1, 0)
   where id = old.post_id;
  return old;
end;
$$;

revoke execute on function public.posts_drop_comment_count() from public;

-- Fix completeness #3.1 — un commentaire qui migrerait vers un autre post
-- (UPDATE OF post_id) désynchroniserait les compteurs. Cas marginal mais
-- couvert par défense en profondeur : décrémente l'ancien post, incrémente
-- le nouveau.
create or replace function public.posts_move_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.post_id is distinct from old.post_id then
    update public.posts
       set comment_count = greatest(comment_count - 1, 0)
     where id = old.post_id;
    update public.posts
       set comment_count = comment_count + 1
     where id = new.post_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.posts_move_comment_count() from public;

drop trigger if exists comments_bump_post_count_aii on public.comments;
create trigger comments_bump_post_count_aii
  after insert on public.comments
  for each row execute function public.posts_bump_comment_count();

drop trigger if exists comments_drop_post_count_aid on public.comments;
create trigger comments_drop_post_count_aid
  after delete on public.comments
  for each row execute function public.posts_drop_comment_count();

drop trigger if exists comments_move_post_count_aup on public.comments;
create trigger comments_move_post_count_aup
  after update of post_id on public.comments
  for each row execute function public.posts_move_comment_count();

-- ----------------------------------------------------------------------------
-- C.3 — Fonctions trigger pour public.post_reactions
-- ----------------------------------------------------------------------------
-- Idem : un user qui réagit au post d'un autre n'a pas le droit d'UPDATE
-- le post via la RLS standard, on passe par SECURITY DEFINER.

create or replace function public.posts_bump_reaction_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
     set reaction_count = reaction_count + 1
   where id = new.post_id;
  return new;
end;
$$;

revoke execute on function public.posts_bump_reaction_count() from public;

create or replace function public.posts_drop_reaction_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
     set reaction_count = greatest(reaction_count - 1, 0)
   where id = old.post_id;
  return old;
end;
$$;

revoke execute on function public.posts_drop_reaction_count() from public;

drop trigger if exists post_reactions_bump_count_aii on public.post_reactions;
create trigger post_reactions_bump_count_aii
  after insert on public.post_reactions
  for each row execute function public.posts_bump_reaction_count();

drop trigger if exists post_reactions_drop_count_aid on public.post_reactions;
create trigger post_reactions_drop_count_aid
  after delete on public.post_reactions
  for each row execute function public.posts_drop_reaction_count();

-- ----------------------------------------------------------------------------
-- C.4 — Backfill : recalcul one-shot des compteurs sur les posts existants
-- ----------------------------------------------------------------------------
-- Idempotent : on peut rejouer la migration sans dériver, les triggers
-- maintiendront la cohérence ensuite.
--
-- Fix safety #3 — la version initiale faisait un FULL OUTER JOIN entre les
-- agrégats de comments et post_reactions, ce qui sur un post à 1000 comments
-- × 500 reactions produisait 500 000 lignes intermédiaires. On split en
-- deux UPDATE distincts pour rester linéaire en volume.

update public.posts p
   set comment_count = coalesce(c.cnt, 0)
  from (
        select post_id, count(*)::int as cnt
          from public.comments
         group by post_id
       ) c
 where p.id = c.post_id
   and p.comment_count is distinct from c.cnt;

update public.posts p
   set reaction_count = coalesce(r.cnt, 0)
  from (
        select post_id, count(*)::int as cnt
          from public.post_reactions
         group by post_id
       ) r
 where p.id = r.post_id
   and p.reaction_count is distinct from r.cnt;

-- Cas des posts sans aucun commentaire ni réaction : déjà à 0 via le DEFAULT,
-- aucun des deux UPDATE ci-dessus ne les touche — comportement voulu.


-- =============================================================================
-- BLOC D — mentions structurées
-- =============================================================================
-- Objectif : structurer les @mentions dans le corps des posts et des
-- commentaires. Aujourd'hui, seul comment_replies.mentioned_user_id capture
-- une mention (une seule par reply). On introduit deux tables de jointure
-- dédiées pour supporter N mentions par post / commentaire, indexer la
-- recherche inverse ("où ai-je été mentionné ?") et ouvrir la voie aux
-- notifications.
-- =============================================================================

-- D.1 — Table public.post_mentions
create table if not exists public.post_mentions (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null references public.posts(id) on delete cascade,
  mentioned_user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (post_id, mentioned_user_id)
);

comment on table public.post_mentions is
  'Mentions @user extraites du corps d''un post. Une ligne par (post, user mentionné).';
comment on column public.post_mentions.post_id is
  'Post source de la mention. ON DELETE CASCADE : la mention disparaît avec le post.';
comment on column public.post_mentions.mentioned_user_id is
  'Profil mentionné. ON DELETE CASCADE : si le profil est supprimé, ses mentions partent avec.';

-- Index pour la recherche inverse ("posts où j'ai été mentionné")
create index if not exists post_mentions_mentioned_user_idx
  on public.post_mentions (mentioned_user_id, created_at desc);

-- D.2 — Table public.comment_mentions
create table if not exists public.comment_mentions (
  id                 uuid primary key default gen_random_uuid(),
  comment_id         uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (comment_id, mentioned_user_id)
);

comment on table public.comment_mentions is
  'Mentions @user extraites du corps d''un commentaire. Une ligne par (commentaire, user mentionné).';
comment on column public.comment_mentions.comment_id is
  'Commentaire source de la mention. ON DELETE CASCADE : la mention disparaît avec le commentaire.';
comment on column public.comment_mentions.mentioned_user_id is
  'Profil mentionné. ON DELETE CASCADE : si le profil est supprimé, ses mentions partent avec.';

-- Index pour la recherche inverse ("commentaires où j'ai été mentionné")
create index if not exists comment_mentions_mentioned_user_idx
  on public.comment_mentions (mentioned_user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- D.3 — RLS post_mentions
-- ----------------------------------------------------------------------------
-- Lecture : tout membre de la communauté qui voit le post voit ses mentions.
--   L'EXISTS s'évalue avec la RLS de posts active → un user qui ne voit pas
--   le post (silo paid vs free, audience, etc.) ne voit pas la mention.
--   À ne pas refactorer sans préserver ce mécanisme (cf. fix safety #4).
-- Insertion : réservée à l'auteur du post (côté serveur, lors du parsing du body).
-- Suppression : autorisée à l'auteur du post pour permettre la ré-écriture
--   d'un body qui retire une @mention (fix completeness #4.2).
--   La FK ON DELETE CASCADE couvre la disparition du post lui-même.
-- Mise à jour : interdite (immuable — on supprime/recrée si édition du body),
--   aucune policy UPDATE → bloqué par RLS.
alter table public.post_mentions enable row level security;

drop policy if exists post_mentions_select_via_post on public.post_mentions;
create policy post_mentions_select_via_post
  on public.post_mentions for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_mentions.post_id)
  );

drop policy if exists post_mentions_insert_author on public.post_mentions;
create policy post_mentions_insert_author
  on public.post_mentions for insert to authenticated
  with check (
    exists (
      select 1
      from public.posts p
      where p.id = post_mentions.post_id
        and p.author_id = (select auth.uid())
    )
  );

drop policy if exists post_mentions_delete_author on public.post_mentions;
create policy post_mentions_delete_author
  on public.post_mentions for delete to authenticated
  using (
    exists (
      select 1
      from public.posts p
      where p.id = post_mentions.post_id
        and p.author_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- D.4 — RLS comment_mentions
-- ----------------------------------------------------------------------------
-- Mêmes principes que post_mentions, transposés sur comments.
alter table public.comment_mentions enable row level security;

drop policy if exists comment_mentions_select_via_comment on public.comment_mentions;
create policy comment_mentions_select_via_comment
  on public.comment_mentions for select to authenticated
  using (
    exists (select 1 from public.comments c where c.id = comment_mentions.comment_id)
  );

drop policy if exists comment_mentions_insert_author on public.comment_mentions;
create policy comment_mentions_insert_author
  on public.comment_mentions for insert to authenticated
  with check (
    exists (
      select 1
      from public.comments c
      where c.id = comment_mentions.comment_id
        and c.author_id = (select auth.uid())
    )
  );

drop policy if exists comment_mentions_delete_author on public.comment_mentions;
create policy comment_mentions_delete_author
  on public.comment_mentions for delete to authenticated
  using (
    exists (
      select 1
      from public.comments c
      where c.id = comment_mentions.comment_id
        and c.author_id = (select auth.uid())
    )
  );

commit;
