-- Migration 014 — Brique 2 (community) — schema data model
-- Foundation : toutes les tables du module community (posts, comments,
-- comment_replies, conversations, messages, 3 tables reactions) + RLS strict.
--
-- HORS SCOPE de cette PR :
--   - Aucun bucket storage (les colonnes image_url/video_url/file_url sont
--     TEXT nullable, prêtes à recevoir des URLs publiques quand la PR bucket
--     sera mergée).
--   - Aucune Server Action (le module community/server est encore vide).
--   - Aucune activation Supabase Realtime sur les tables (PR séparée).
--   - Aucun branchement UI (le module community continue de servir ses mocks).
--
-- ⚠️  Ticket Sensible — la RLS visibilité repose sur user_has_capability et
--     les rôles profiles.role. Une faille ici = leak de contenu paid_only à
--     des users free, ou exposition de DMs entre tiers. À audit serré.

-- ============================================================================
-- 0. Helper — petit wrapper pour récupérer le role du caller
-- ============================================================================
-- Utilisé par les policies INSERT/UPDATE des posts (admins/mentors peuvent
-- poster pour le compte de quelqu'un d'autre). Inline dans la policy serait
-- plus rapide mais nécessiterait de répéter la même expression partout.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

comment on function public.current_profile_role() is
  'Helper RLS : retourne le role du caller (member/mentor/admin) depuis profiles. NULL si pas auth.';

-- ============================================================================
-- 1. Table posts — feed communauté
-- ============================================================================
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  tag           text not null
                check (tag in ('general', 'question', 'presentation', 'annonce')),
  audience      text not null default 'all'
                check (audience in ('all', 'free_only', 'paid_only')),
  title         text,
  body          text not null,
  -- URLs prêtes pour PR bucket. NULL = pas de média.
  image_url     text,
  video_url     text,
  -- Épinglage : pinned + pinned_until optionnel (NULL = épinglé indéfiniment)
  pinned        boolean not null default false,
  pinned_until  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.posts is
  'Posts du feed communauté. audience pilote la visibilité via RLS (cf. user_has_capability can_view_paid_content).';

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- Indexes : feed trié par created_at DESC, les épinglés remontent toujours
create index if not exists posts_created_at_idx
  on public.posts (created_at desc);
create index if not exists posts_pinned_idx
  on public.posts (pinned, pinned_until) where pinned = true;
create index if not exists posts_author_idx
  on public.posts (author_id);

-- ============================================================================
-- 2. Tables comments + comment_replies — 2 niveaux
-- ============================================================================
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

create index if not exists comments_post_idx
  on public.comments (post_id, created_at);
create index if not exists comments_author_idx
  on public.comments (author_id);

create table if not exists public.comment_replies (
  id                  uuid primary key default gen_random_uuid(),
  comment_id          uuid not null references public.comments(id) on delete cascade,
  author_id           uuid not null references public.profiles(id) on delete cascade,
  body                text not null,
  -- Mention @user — référence le profile mentionné, pas un parsing du body.
  -- Permet d'afficher "→ @TheoG" en lien cliquable même si l'user renomme.
  mentioned_user_id   uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists comment_replies_set_updated_at on public.comment_replies;
create trigger comment_replies_set_updated_at
  before update on public.comment_replies
  for each row execute function public.set_updated_at();

create index if not exists comment_replies_comment_idx
  on public.comment_replies (comment_id, created_at);

-- ============================================================================
-- 3. Tables conversations + messages — DM 1-1
-- ============================================================================
-- Modèle pair direct (participant_a, participant_b) avec contrainte a < b
-- pour garantir l'unicité de la paire (Théo↔Salim n'a qu'UNE conversation
-- peu importe qui a démarré).
create table if not exists public.conversations (
  id                 uuid primary key default gen_random_uuid(),
  participant_a_id   uuid not null references public.profiles(id) on delete cascade,
  participant_b_id   uuid not null references public.profiles(id) on delete cascade,
  -- Dénormalisation : last_message_at pour trier la conversation list sans
  -- avoir à joinder messages à chaque fetch. Mis à jour à l'insert d'un message.
  last_message_at    timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  -- a < b pour unicité de paire + interdire self-DM
  constraint conversations_pair_ordered check (participant_a_id < participant_b_id),
  constraint conversations_pair_unique  unique (participant_a_id, participant_b_id)
);

comment on table public.conversations is
  'Conversations DM 1-1. Contrainte participant_a < participant_b pour garantir unicité de la paire.';

create index if not exists conversations_participant_a_idx
  on public.conversations (participant_a_id, last_message_at desc);
create index if not exists conversations_participant_b_idx
  on public.conversations (participant_b_id, last_message_at desc);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  type             text not null default 'text'
                   check (type in ('text', 'image', 'pdf')),
  body             text not null default '',
  file_url         text,
  file_name        text,
  deleted          boolean not null default false,
  created_at       timestamptz not null default now(),
  edited_at        timestamptz
);

comment on table public.messages is
  'Messages DM. deleted = soft-delete (corps masqué UI, ligne conservée pour audit). edited_at NULL si jamais édité.';

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at desc);

-- ============================================================================
-- 4. Reactions — 3 tables dédiées (post / comment / message)
-- ============================================================================
-- PK composite (parent_id, user_id, emoji) : un user ne peut mettre un emoji
-- donné qu'une seule fois sur un même parent. Pour permettre plusieurs emojis
-- du même user on les met sur la PK.
create table if not exists public.post_reactions (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
create index if not exists post_reactions_post_idx
  on public.post_reactions (post_id);

create table if not exists public.comment_reactions (
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);
create index if not exists comment_reactions_comment_idx
  on public.comment_reactions (comment_id);

create table if not exists public.message_reactions (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

-- ============================================================================
-- 5. RLS — posts
-- ============================================================================
-- SELECT : peut voir si (a) a la capability can_view_community ET
--                       (b) l'audience l'autorise :
--                           - 'all'        → toujours OK
--                           - 'free_only'  → toujours OK (les free ET les paid voient)
--                           - 'paid_only'  → seulement si can_view_paid_content
-- INSERT : auth.uid() = author_id (un user poste pour son propre compte)
--          OU caller est admin/mentor (peut poster pour quelqu'un d'autre,
--          ex: annonces orga). Toujours can_view_community.
-- UPDATE : author (édition de son post) OU admin/mentor (modération).
-- DELETE : author OU admin/mentor.

alter table public.posts enable row level security;

drop policy if exists posts_select_community on public.posts;
create policy posts_select_community
  on public.posts for select to authenticated
  using (
    public.user_has_capability((select auth.uid()), 'can_view_community')
    and (
      audience in ('all', 'free_only')
      or (
        audience = 'paid_only'
        and public.user_has_capability((select auth.uid()), 'can_view_paid_content')
      )
    )
  );

drop policy if exists posts_insert_self_or_admin on public.posts;
create policy posts_insert_self_or_admin
  on public.posts for insert to authenticated
  with check (
    public.user_has_capability((select auth.uid()), 'can_view_community')
    and (
      author_id = (select auth.uid())
      or public.current_profile_role() in ('admin', 'mentor')
    )
  );

drop policy if exists posts_update_author_or_admin on public.posts;
create policy posts_update_author_or_admin
  on public.posts for update to authenticated
  using (
    author_id = (select auth.uid())
    or public.current_profile_role() in ('admin', 'mentor')
  )
  with check (
    author_id = (select auth.uid())
    or public.current_profile_role() in ('admin', 'mentor')
  );

drop policy if exists posts_delete_author_or_admin on public.posts;
create policy posts_delete_author_or_admin
  on public.posts for delete to authenticated
  using (
    author_id = (select auth.uid())
    or public.current_profile_role() in ('admin', 'mentor')
  );

-- ============================================================================
-- 6. RLS — comments + comment_replies
-- ============================================================================
-- Règle : un comment hérite la visibilité de son post parent.
-- SELECT : EXISTS un post parent que je peux voir (réutilise la policy posts).
-- INSERT : idem + author_id = auth.uid().
-- UPDATE/DELETE : author OU admin/mentor.

alter table public.comments enable row level security;

drop policy if exists comments_select_via_post on public.comments;
create policy comments_select_via_post
  on public.comments for select to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = comments.post_id
      -- La policy posts_select_community filtre déjà ; un EXISTS sur posts
      -- ne renvoie une ligne que si la RLS posts l'autorise.
    )
  );

drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self
  on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.posts p where p.id = comments.post_id
    )
  );

drop policy if exists comments_update_author_or_admin on public.comments;
create policy comments_update_author_or_admin
  on public.comments for update to authenticated
  using (
    author_id = (select auth.uid())
    or public.current_profile_role() in ('admin', 'mentor')
  )
  with check (
    author_id = (select auth.uid())
    or public.current_profile_role() in ('admin', 'mentor')
  );

drop policy if exists comments_delete_author_or_admin on public.comments;
create policy comments_delete_author_or_admin
  on public.comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or public.current_profile_role() in ('admin', 'mentor')
  );

alter table public.comment_replies enable row level security;

drop policy if exists comment_replies_select_via_comment on public.comment_replies;
create policy comment_replies_select_via_comment
  on public.comment_replies for select to authenticated
  using (
    exists (
      select 1 from public.comments c where c.id = comment_replies.comment_id
    )
  );

drop policy if exists comment_replies_insert_self on public.comment_replies;
create policy comment_replies_insert_self
  on public.comment_replies for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.comments c where c.id = comment_replies.comment_id
    )
  );

drop policy if exists comment_replies_update_author_or_admin on public.comment_replies;
create policy comment_replies_update_author_or_admin
  on public.comment_replies for update to authenticated
  using (
    author_id = (select auth.uid())
    or public.current_profile_role() in ('admin', 'mentor')
  )
  with check (
    author_id = (select auth.uid())
    or public.current_profile_role() in ('admin', 'mentor')
  );

drop policy if exists comment_replies_delete_author_or_admin on public.comment_replies;
create policy comment_replies_delete_author_or_admin
  on public.comment_replies for delete to authenticated
  using (
    author_id = (select auth.uid())
    or public.current_profile_role() in ('admin', 'mentor')
  );

-- ============================================================================
-- 7. RLS — conversations + messages
-- ============================================================================
-- Conversations : visible uniquement par les 2 participants.
-- Messages : visible / insertable uniquement par les 2 participants de la
--            conversation parente. Pas d'admin override pour les DM (vie
--            privée). Édition = sender uniquement. Suppression soft = sender
--            uniquement (set deleted=true).
--
-- INSERT conversation : un user crée une conversation où il est l'un des
-- participants. La contrainte a<b garantit qu'on insère toujours dans le bon
-- ordre côté Server Action (helper applicatif à fournir).

alter table public.conversations enable row level security;

drop policy if exists conversations_select_participants on public.conversations;
create policy conversations_select_participants
  on public.conversations for select to authenticated
  using (
    participant_a_id = (select auth.uid())
    or participant_b_id = (select auth.uid())
  );

drop policy if exists conversations_insert_self on public.conversations;
create policy conversations_insert_self
  on public.conversations for insert to authenticated
  with check (
    participant_a_id = (select auth.uid())
    or participant_b_id = (select auth.uid())
  );

drop policy if exists conversations_update_participants on public.conversations;
create policy conversations_update_participants
  on public.conversations for update to authenticated
  using (
    participant_a_id = (select auth.uid())
    or participant_b_id = (select auth.uid())
  )
  with check (
    participant_a_id = (select auth.uid())
    or participant_b_id = (select auth.uid())
  );

alter table public.messages enable row level security;

drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant_a_id = (select auth.uid())
             or c.participant_b_id = (select auth.uid()))
    )
  );

drop policy if exists messages_insert_self on public.messages;
create policy messages_insert_self
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant_a_id = (select auth.uid())
             or c.participant_b_id = (select auth.uid()))
    )
  );

drop policy if exists messages_update_sender on public.messages;
create policy messages_update_sender
  on public.messages for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

-- Pas de DELETE policy : on utilise soft-delete via UPDATE deleted=true.

-- ============================================================================
-- 8. RLS — reactions (3 tables)
-- ============================================================================
-- Pattern uniforme :
--   SELECT : peut voir la réaction si visibilité du parent OK (delegate via EXISTS).
--   INSERT : user_id = auth.uid() + visibilité parent OK.
--   DELETE : user_id = auth.uid() (chacun retire ses propres réactions).
-- Pas d'UPDATE : on supprime/recrée plutôt qu'éditer (changement d'emoji = 2 ops).

-- ── post_reactions ──────────────────────────────────────────────────────────
alter table public.post_reactions enable row level security;

drop policy if exists post_reactions_select_via_post on public.post_reactions;
create policy post_reactions_select_via_post
  on public.post_reactions for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_reactions.post_id)
  );

drop policy if exists post_reactions_insert_self on public.post_reactions;
create policy post_reactions_insert_self
  on public.post_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_reactions.post_id)
  );

drop policy if exists post_reactions_delete_self on public.post_reactions;
create policy post_reactions_delete_self
  on public.post_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── comment_reactions ──────────────────────────────────────────────────────
alter table public.comment_reactions enable row level security;

drop policy if exists comment_reactions_select_via_comment on public.comment_reactions;
create policy comment_reactions_select_via_comment
  on public.comment_reactions for select to authenticated
  using (
    exists (select 1 from public.comments c where c.id = comment_reactions.comment_id)
  );

drop policy if exists comment_reactions_insert_self on public.comment_reactions;
create policy comment_reactions_insert_self
  on public.comment_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.comments c where c.id = comment_reactions.comment_id)
  );

drop policy if exists comment_reactions_delete_self on public.comment_reactions;
create policy comment_reactions_delete_self
  on public.comment_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── message_reactions ──────────────────────────────────────────────────────
alter table public.message_reactions enable row level security;

drop policy if exists message_reactions_select_via_message on public.message_reactions;
create policy message_reactions_select_via_message
  on public.message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
    )
  );

drop policy if exists message_reactions_insert_self on public.message_reactions;
create policy message_reactions_insert_self
  on public.message_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
    )
  );

drop policy if exists message_reactions_delete_self on public.message_reactions;
create policy message_reactions_delete_self
  on public.message_reactions for delete to authenticated
  using (user_id = (select auth.uid()));
