-- Migration 038 — Brique Community — centre de notifications in-app
--
-- Date    : 2026-06-12
-- Auteur  : Notion Club Infra
-- Module  : community (suite de 030_community_dm_email_notifications.sql)
--
-- Pitch
-- -----
-- Jusqu'ici, la cloche du dashboard affichait un compteur "2" hardcodé et le
-- popover de notifications tournait sur des données mockées. Cette migration
-- pose la vraie brique back : une table `notifications` alimentée par des
-- triggers Postgres à chaque événement communautaire (mention, commentaire,
-- réponse, réaction, DM, annonce admin), lue côté client via Supabase Realtime
-- pour un badge qui s'incrémente en live.
--
-- Choix d'architecture : triggers DB plutôt que logique applicative.
--   - Cohérent avec le précédent enqueue_dm_email_notification (mig. 030).
--   - Aucune duplication dans les 5+ server actions community (create post,
--     comment, reply, réactions, message). Le jour où un nouveau chemin
--     d'écriture est ajouté, la notif est générée automatiquement.
--   - SECURITY DEFINER + search_path figé + REVOKE EXECUTE FROM PUBLIC sur
--     chaque fonction, exactement comme migrations 020 / 030.
--
-- Règles métier communes à tous les triggers
-- -------------------------------------------
--   - Jamais d'auto-notification : si actor_id = recipient_id, on skip.
--     (Inutile de me notifier que j'ai commenté mon propre post.)
--   - Une notification = une ligne (recipient_id, actor_id, type, + refs).
--     read_at NULL = non lue. On ne dédup pas : 3 réactions = 3 lignes.
--   - L'excerpt est un court extrait dénormalisé (titre de post, début de
--     commentaire/message) pour éviter une jointure lourde au read. Clippé
--     à 140 chars côté SQL.
--
-- Périmètre des événements notifiés (7 types, alignés sur le type UI
-- Notification de src/modules/community/types/notification.types.ts) :
--   mention_post      → post_mentions          → le mentionné
--   mention_comment   → comment_mentions       → le mentionné
--                       comment_reply_mentions → le mentionné
--   comment_on_post   → comments               → l'auteur du post
--   reply_to_comment  → comment_replies        → l'auteur du commentaire parent
--   reaction_on_post  → post_reactions         → l'auteur du post
--   new_dm            → messages               → l'autre participant
--   admin_annonce     → posts (tag='annonce')  → fan-out tous les membres
--
-- Hors-scope (assumé) : réactions sur commentaires/replies (pas de type UI
-- dédié), notifications de formation/coaching (autres modules).
-- =============================================================================

begin;

-- =============================================================================
-- 1. Table notifications
-- =============================================================================
-- Un seul type énuméré (text + CHECK, cohérent avec posts.tag/audience). Les
-- colonnes de référence (post_id / comment_id / conversation_id) sont toutes
-- nullables : selon le type, une seule est renseignée. Elles servent au
-- deep-link côté UI (clic sur la notif → post ou conversation).

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  -- Destinataire. ON DELETE CASCADE : un user supprimé perd ses notifs.
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  -- Acteur à l'origine (qui a mentionné / commenté / réagi / écrit).
  -- ON DELETE CASCADE : si l'acteur disparaît, la notif n'a plus de sens.
  actor_id        uuid not null references public.profiles(id) on delete cascade,
  type            text not null check (type in (
                    'mention_post',
                    'mention_comment',
                    'comment_on_post',
                    'reply_to_comment',
                    'reaction_on_post',
                    'new_dm',
                    'admin_annonce'
                  )),
  -- Références optionnelles pour le deep-link. Une seule renseignée selon type.
  post_id         uuid references public.posts(id) on delete cascade,
  comment_id      uuid references public.comments(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  -- Extrait dénormalisé (titre du post / début du commentaire ou message).
  excerpt         text,
  -- NULL = non lue. Stamp à la lecture (markAsRead côté serveur).
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.notifications is
  'Centre de notifications in-app par user. Une ligne = un événement '
  'communautaire destiné à recipient_id, alimenté par triggers (cf. mig. 038). '
  'read_at NULL = non lue. Lu côté client via Supabase Realtime.';
comment on column public.notifications.actor_id is
  'Profil à l''origine de l''événement. Jamais égal à recipient_id (les '
  'triggers skippent l''auto-notification).';
comment on column public.notifications.excerpt is
  'Extrait dénormalisé (titre post / début commentaire/message) clippé 140 '
  'chars, pour éviter une jointure au read.';

-- Index principal : le feed d'un user, trié antichronologiquement.
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

-- Index partiel pour le compteur de non-lues (badge cloche) : ne couvre que
-- les lignes pertinentes, reste petit même avec un gros historique.
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

-- =============================================================================
-- 2. RLS — un user ne voit et ne marque comme lu QUE ses propres notifs
-- =============================================================================
-- Les triggers sont SECURITY DEFINER → ils insèrent en bypassant la RLS.
-- Aucune policy INSERT côté client : un user ne peut pas se fabriquer de
-- fausses notifs. UPDATE limité au passage read_at (mark as read) sur ses
-- lignes ; DELETE autorisé pour permettre un "effacer" futur.

alter table public.notifications enable row level security;

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

-- UPDATE self : sert au mark-as-read. La WITH CHECK empêche un user de
-- réassigner une notif à quelqu'un d'autre via UPDATE.
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

drop policy if exists notifications_delete_self on public.notifications;
create policy notifications_delete_self
  on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));

-- Pas de policy INSERT : seul le service_role et les triggers SECURITY DEFINER
-- écrivent. Un client authentifié ne peut pas INSERT (RLS le bloque).

-- =============================================================================
-- 3. Helper : insertion d'une notification (skip auto-notification)
-- =============================================================================
-- Factorise la règle "jamais actor = recipient" + le clip de l'excerpt.
-- Appelé par toutes les fonctions trigger ci-dessous. SECURITY DEFINER hérité
-- du contexte appelant (la fonction est appelée DANS un trigger SECURITY
-- DEFINER), mais on la marque aussi DEFINER pour pouvoir l'appeler en direct
-- au besoin (backfill, tests).

create or replace function public.create_notification(
  p_recipient_id    uuid,
  p_actor_id        uuid,
  p_type            text,
  p_post_id         uuid default null,
  p_comment_id      uuid default null,
  p_conversation_id uuid default null,
  p_excerpt         text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Garde-fou central : pas d'auto-notification, et recipient obligatoire.
  if p_recipient_id is null or p_actor_id is null then return; end if;
  if p_recipient_id = p_actor_id then return; end if;

  insert into public.notifications
    (recipient_id, actor_id, type, post_id, comment_id, conversation_id, excerpt)
  values
    (p_recipient_id, p_actor_id, p_type, p_post_id, p_comment_id, p_conversation_id,
     left(p_excerpt, 140));
end;
$$;

comment on function public.create_notification(uuid,uuid,text,uuid,uuid,uuid,text) is
  'Insère une notification en appliquant la règle no-self-notify et le clip '
  'd''excerpt. Appelée par les fonctions trigger de la mig. 038.';

-- ⚠️ Sécurité : create_notification a une signature appelable (uuid/text) et
-- est SECURITY DEFINER → sans revoke explicite, un user authentifié pourrait
-- la déclencher via PostgREST (/rest/v1/rpc/create_notification) et FORGER des
-- notifications à n'importe qui, contournant l'absence de policy INSERT. On
-- révoque de public ET de anon/authenticated (qui détiennent un grant propre
-- non couvert par REVOKE FROM public). Cf. bloc de durcissement final.
revoke execute on function public.create_notification(uuid,uuid,text,uuid,uuid,uuid,text) from public, anon, authenticated;

-- =============================================================================
-- 4. Trigger : commentaire sur un post → notifie l'auteur du post
-- =============================================================================
-- Le commentateur (NEW.author_id) notifie l'auteur du post. Skip si c'est son
-- propre post (géré par create_notification). L'excerpt = début du commentaire.

create or replace function public.notify_comment_on_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post_author uuid;
begin
  select author_id into v_post_author
    from public.posts where id = new.post_id;
  if v_post_author is null then return new; end if;

  perform public.create_notification(
    p_recipient_id => v_post_author,
    p_actor_id     => new.author_id,
    p_type         => 'comment_on_post',
    p_post_id      => new.post_id,
    p_comment_id   => new.id,
    p_excerpt      => new.body
  );
  return new;
end;
$$;

revoke execute on function public.notify_comment_on_post() from public;

drop trigger if exists comments_notify_author_aii on public.comments;
create trigger comments_notify_author_aii
  after insert on public.comments
  for each row execute function public.notify_comment_on_post();

-- =============================================================================
-- 5. Trigger : réponse à un commentaire → notifie l'auteur du commentaire
-- =============================================================================
-- Le répondeur (NEW.author_id) notifie l'auteur du commentaire parent. On
-- remonte aussi post_id (via le commentaire parent) pour le deep-link.

create or replace function public.notify_reply_to_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comment_author uuid;
  v_post_id        uuid;
begin
  select author_id, post_id into v_comment_author, v_post_id
    from public.comments where id = new.comment_id;
  if v_comment_author is null then return new; end if;

  perform public.create_notification(
    p_recipient_id => v_comment_author,
    p_actor_id     => new.author_id,
    p_type         => 'reply_to_comment',
    p_post_id      => v_post_id,
    p_comment_id   => new.comment_id,
    p_excerpt      => new.body
  );
  return new;
end;
$$;

revoke execute on function public.notify_reply_to_comment() from public;

drop trigger if exists comment_replies_notify_author_aii on public.comment_replies;
create trigger comment_replies_notify_author_aii
  after insert on public.comment_replies
  for each row execute function public.notify_reply_to_comment();

-- =============================================================================
-- 6. Trigger : réaction sur un post → notifie l'auteur du post
-- =============================================================================
-- Le réacteur (NEW.user_id) notifie l'auteur du post. Excerpt = titre du post
-- (ou début du body si pas de titre). Réactions sur commentaires/replies non
-- couvertes (pas de type UI dédié — hors-scope assumé).

create or replace function public.notify_reaction_on_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post_author uuid;
  v_excerpt     text;
begin
  select author_id, coalesce(nullif(title, ''), body)
    into v_post_author, v_excerpt
    from public.posts where id = new.post_id;
  if v_post_author is null then return new; end if;

  perform public.create_notification(
    p_recipient_id => v_post_author,
    p_actor_id     => new.user_id,
    p_type         => 'reaction_on_post',
    p_post_id      => new.post_id,
    p_excerpt      => v_excerpt
  );
  return new;
end;
$$;

revoke execute on function public.notify_reaction_on_post() from public;

drop trigger if exists post_reactions_notify_author_aii on public.post_reactions;
create trigger post_reactions_notify_author_aii
  after insert on public.post_reactions
  for each row execute function public.notify_reaction_on_post();

-- =============================================================================
-- 7. Triggers : mentions → notifient le mentionné
-- =============================================================================
-- Trois tables de jointure (post_mentions, comment_mentions,
-- comment_reply_mentions) posées en 020 / 022. Chacune insère un (source, user
-- mentionné). On notifie mentioned_user_id, l'acteur étant l'auteur de la
-- source. On doit donc remonter l'auteur + l'excerpt depuis la source.

-- 7.A — post_mentions → mention_post
create or replace function public.notify_mention_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author  uuid;
  v_excerpt text;
begin
  select author_id, coalesce(nullif(title, ''), body)
    into v_author, v_excerpt
    from public.posts where id = new.post_id;
  if v_author is null then return new; end if;

  perform public.create_notification(
    p_recipient_id => new.mentioned_user_id,
    p_actor_id     => v_author,
    p_type         => 'mention_post',
    p_post_id      => new.post_id,
    p_excerpt      => v_excerpt
  );
  return new;
end;
$$;

revoke execute on function public.notify_mention_post() from public;

drop trigger if exists post_mentions_notify_aii on public.post_mentions;
create trigger post_mentions_notify_aii
  after insert on public.post_mentions
  for each row execute function public.notify_mention_post();

-- 7.B — comment_mentions → mention_comment
create or replace function public.notify_mention_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author  uuid;
  v_post_id uuid;
  v_excerpt text;
begin
  select author_id, post_id, body
    into v_author, v_post_id, v_excerpt
    from public.comments where id = new.comment_id;
  if v_author is null then return new; end if;

  perform public.create_notification(
    p_recipient_id => new.mentioned_user_id,
    p_actor_id     => v_author,
    p_type         => 'mention_comment',
    p_post_id      => v_post_id,
    p_comment_id   => new.comment_id,
    p_excerpt      => v_excerpt
  );
  return new;
end;
$$;

revoke execute on function public.notify_mention_comment() from public;

drop trigger if exists comment_mentions_notify_aii on public.comment_mentions;
create trigger comment_mentions_notify_aii
  after insert on public.comment_mentions
  for each row execute function public.notify_mention_comment();

-- 7.C — comment_reply_mentions → mention_comment (même type UI, source reply)
create or replace function public.notify_mention_reply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author  uuid;
  v_post_id uuid;
  v_excerpt text;
begin
  -- Remonte l'auteur + le body de la reply, et le post via le commentaire parent.
  select cr.author_id, cr.body, c.post_id
    into v_author, v_excerpt, v_post_id
    from public.comment_replies cr
    join public.comments c on c.id = cr.comment_id
   where cr.id = new.comment_reply_id;
  if v_author is null then return new; end if;

  perform public.create_notification(
    p_recipient_id => new.mentioned_user_id,
    p_actor_id     => v_author,
    p_type         => 'mention_comment',
    p_post_id      => v_post_id,
    p_excerpt      => v_excerpt
  );
  return new;
end;
$$;

revoke execute on function public.notify_mention_reply() from public;

drop trigger if exists comment_reply_mentions_notify_aii on public.comment_reply_mentions;
create trigger comment_reply_mentions_notify_aii
  after insert on public.comment_reply_mentions
  for each row execute function public.notify_mention_reply();

-- =============================================================================
-- 8. Trigger : nouveau DM → notifie l'autre participant
-- =============================================================================
-- Reprend la logique de résolution destinataire de enqueue_dm_email_notification
-- (mig. 030). Le destinataire est le participant qui n'est PAS sender_id.
-- Excerpt = corps du message (vide pour image/pdf → fallback type).

create or replace function public.notify_new_dm()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_participant_a uuid;
  v_participant_b uuid;
  v_recipient_id  uuid;
  v_excerpt       text;
begin
  if new.deleted is true then return new; end if;

  select participant_a_id, participant_b_id
    into v_participant_a, v_participant_b
    from public.conversations where id = new.conversation_id;
  if v_participant_a is null then return new; end if;

  if new.sender_id = v_participant_a then
    v_recipient_id := v_participant_b;
  else
    v_recipient_id := v_participant_a;
  end if;

  -- Pour les pièces jointes, body est vide → label parlant.
  v_excerpt := case
    when new.type = 'image' then '📷 Image'
    when new.type = 'pdf'   then '📄 Document'
    else new.body
  end;

  perform public.create_notification(
    p_recipient_id    => v_recipient_id,
    p_actor_id        => new.sender_id,
    p_type            => 'new_dm',
    p_conversation_id => new.conversation_id,
    p_excerpt         => v_excerpt
  );
  return new;
end;
$$;

revoke execute on function public.notify_new_dm() from public;

drop trigger if exists messages_notify_recipient_aii on public.messages;
create trigger messages_notify_recipient_aii
  after insert on public.messages
  for each row execute function public.notify_new_dm();

-- =============================================================================
-- 9. Trigger : annonce admin (post tag='annonce') → fan-out à tous les membres
-- =============================================================================
-- Une annonce concerne tout le monde. On insère une notification par membre
-- non-banni de l'organisation de l'auteur, sauf l'auteur lui-même (filtré par
-- le <> author_id ; create_notification ne peut pas dédupliquer en bulk, on
-- exclut donc en amont). Set-based : un seul INSERT ... SELECT, pas de boucle.
--
-- Volumétrie : N lignes par annonce. Les annonces sont rares (admin only via
-- RLS mig. 021) et l'INSERT set-based reste linéaire. L'index partiel unread
-- absorbe la lecture du badge.
--
-- On ne déclenche que si tag='annonce' à l'INSERT (clause WHEN au niveau du
-- trigger, indexable, évite d'entrer dans la fonction pour les posts normaux).

create or replace function public.notify_admin_annonce()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id  uuid;
  v_excerpt text;
begin
  -- Org de l'auteur, pour cibler le bon périmètre de membres.
  select organization_id into v_org_id
    from public.profiles where id = new.author_id;
  if v_org_id is null then return new; end if;

  v_excerpt := left(coalesce(nullif(new.title, ''), new.body), 140);

  insert into public.notifications
    (recipient_id, actor_id, type, post_id, excerpt)
  select
    p.id, new.author_id, 'admin_annonce', new.id, v_excerpt
  from public.profiles p
  where p.organization_id = v_org_id
    and p.is_banned = false
    and p.id <> new.author_id;  -- pas d'auto-notification

  return new;
end;
$$;

revoke execute on function public.notify_admin_annonce() from public;

drop trigger if exists posts_notify_annonce_aii on public.posts;
create trigger posts_notify_annonce_aii
  after insert on public.posts
  for each row
  when (new.tag = 'annonce')
  execute function public.notify_admin_annonce();

-- =============================================================================
-- 9b. Durcissement sécurité — révoquer anon/authenticated sur les fonctions
-- =============================================================================
-- Supabase expose les fonctions du schéma public au rôle anon/authenticated via
-- PostgREST. `REVOKE FROM public` (fait au fil des fonctions) ne suffit pas :
-- anon/authenticated détiennent un grant EXECUTE propre. Pour les fonctions
-- trigger (retour `trigger`), PostgREST refuse l'appel RPC — le risque y est
-- théorique — mais on révoque tout de même pour neutraliser les advisors
-- (lints 0028/0029) et rester cohérent avec le verrou sur create_notification.

revoke execute on function public.notify_comment_on_post()     from anon, authenticated;
revoke execute on function public.notify_reply_to_comment()    from anon, authenticated;
revoke execute on function public.notify_reaction_on_post()    from anon, authenticated;
revoke execute on function public.notify_mention_post()        from anon, authenticated;
revoke execute on function public.notify_mention_comment()     from anon, authenticated;
revoke execute on function public.notify_mention_reply()       from anon, authenticated;
revoke execute on function public.notify_new_dm()              from anon, authenticated;
revoke execute on function public.notify_admin_annonce()       from anon, authenticated;

-- =============================================================================
-- 10. Supabase Realtime — publier la table notifications
-- =============================================================================
-- Le hook client s'abonne à postgres_changes (INSERT) filtré sur recipient_id
-- pour incrémenter le badge en live. Il faut ajouter la table à la publication
-- supabase_realtime. REPLICA IDENTITY FULL pour que le payload Realtime porte
-- les colonnes filtrables (recipient_id) côté abonnement.
--
-- Idempotent : on ne ré-ajoute pas si déjà présent (sinon erreur 42710).

alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

commit;
