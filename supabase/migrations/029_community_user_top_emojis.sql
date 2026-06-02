-- Migration 029 — Brique Community — Top emojis personnalisés par user
--
-- Date    : 2026-06-02
-- Auteur  : Notion Club Infra
-- Module  : community (DM + posts/comments)
--
-- Pitch
-- -----
-- La toolbar quick-reaction du MessageBubble (refonte UX DM) affiche 3
-- emojis "favoris" par user — ceux qu'il utilise le plus fréquemment. Quand
-- un user n'a pas encore d'historique, on retombe sur 3 defaults figés
-- côté code (`👍 😂 🙌`) — la migration ne stocke pas les defaults.
--
-- Approche : table cache user_emoji_stats(user_id, emoji, count). Maintenue
-- par 3 triggers (message_reactions, comment_reactions, comment_reply_reactions
-- et post_reactions — tout ce qui produit une "réaction") qui bump le count
-- au INSERT et le déduisent au DELETE. La lecture devient un simple SELECT
-- top 3 par count.
--
-- Pourquoi pas un GROUP BY runtime ?
-- ----------------------------------------------------------------------------
-- - Le hot path est "afficher la toolbar au hover" : 50ms latency budget.
-- - Un GROUP BY sur 4 tables réactions à chaque hover serait O(N) par user.
-- - La table cache pèse <50 octets par couple (user, emoji), totalement
--   négligeable même pour 10k users avec 20 emojis chacun.
--
-- ⚠️ Ticket Sensible
-- Les triggers utilisent SECURITY DEFINER pour bypass RLS sur user_emoji_stats
-- (sinon un INSERT depuis l'auteur d'une réaction sur une réaction LUI étant
-- adressée échouerait — le RLS de la table cache est strict). Justification :
-- le trigger n'écrit jamais dans une ligne autre que celle de auth.uid() qui
-- est déjà connue côté DB.
-- =============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Table cache
-- ----------------------------------------------------------------------------
create table if not exists public.user_emoji_stats (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  count      integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, emoji)
);

comment on table public.user_emoji_stats is
  'Cache des emojis les plus utilisés par chaque user. Maintenu par triggers '
  'sur message_reactions, comment_reactions, comment_reply_reactions, '
  'post_reactions. Lu par get_user_top_emojis(user_id, limit) pour alimenter '
  'la toolbar quick-reaction du MessageBubble (et autres futurs hot paths).';

-- Index sur (user_id, count desc) pour la requête top 3 : index direct
-- → pas de scan + sort.
create index if not exists user_emoji_stats_user_count_idx
  on public.user_emoji_stats (user_id, count desc);

-- ----------------------------------------------------------------------------
-- RLS — un user voit/écrit uniquement ses propres stats
-- ----------------------------------------------------------------------------
alter table public.user_emoji_stats enable row level security;

drop policy if exists user_emoji_stats_select_self on public.user_emoji_stats;
create policy user_emoji_stats_select_self
  on public.user_emoji_stats for select to authenticated
  using (user_id = (select auth.uid()));

-- Pas de policy INSERT/UPDATE/DELETE pour authenticated : seul le trigger
-- SECURITY DEFINER écrit. Ça évite qu'un user gonfle ses propres stats
-- artificiellement (et que le bouton + de la toolbar reflète des choix
-- "réels").

-- ----------------------------------------------------------------------------
-- Fonction trigger — bump (+1) ou désincrémente (-1) selon TG_OP
-- ----------------------------------------------------------------------------
create or replace function public.bump_user_emoji_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_emoji   text;
  v_delta   integer;
begin
  if (TG_OP = 'INSERT') then
    v_user_id := NEW.user_id;
    v_emoji   := NEW.emoji;
    v_delta   := 1;
  elsif (TG_OP = 'DELETE') then
    v_user_id := OLD.user_id;
    v_emoji   := OLD.emoji;
    v_delta   := -1;
  else
    return NULL; -- UPDATE non géré (les réactions sont immuables : delete+insert).
  end if;

  insert into public.user_emoji_stats (user_id, emoji, count, updated_at)
  values (v_user_id, v_emoji, greatest(v_delta, 0), now())
  on conflict (user_id, emoji) do update
  set count      = greatest(user_emoji_stats.count + v_delta, 0),
      updated_at = now();

  return null; -- AFTER trigger ne lit pas le retour.
end;
$$;

comment on function public.bump_user_emoji_stats() is
  'Trigger AFTER INSERT/DELETE pour les 4 tables de réactions. Maintient le '
  'cache user_emoji_stats. SECURITY DEFINER pour bypass RLS sur la table '
  'cache (l''insert utilise user_id du tuple en cours, donc pas d''abuse '
  'possible).';

-- ----------------------------------------------------------------------------
-- Attache le trigger sur les 4 tables de réactions
-- ----------------------------------------------------------------------------
drop trigger if exists bump_user_emoji_stats_on_message_reactions on public.message_reactions;
create trigger bump_user_emoji_stats_on_message_reactions
  after insert or delete on public.message_reactions
  for each row execute function public.bump_user_emoji_stats();

drop trigger if exists bump_user_emoji_stats_on_comment_reactions on public.comment_reactions;
create trigger bump_user_emoji_stats_on_comment_reactions
  after insert or delete on public.comment_reactions
  for each row execute function public.bump_user_emoji_stats();

drop trigger if exists bump_user_emoji_stats_on_comment_reply_reactions on public.comment_reply_reactions;
create trigger bump_user_emoji_stats_on_comment_reply_reactions
  after insert or delete on public.comment_reply_reactions
  for each row execute function public.bump_user_emoji_stats();

drop trigger if exists bump_user_emoji_stats_on_post_reactions on public.post_reactions;
create trigger bump_user_emoji_stats_on_post_reactions
  after insert or delete on public.post_reactions
  for each row execute function public.bump_user_emoji_stats();

-- ----------------------------------------------------------------------------
-- Helper get_user_top_emojis — interface lecture publique
-- ----------------------------------------------------------------------------
-- Renvoie les N emojis les plus utilisés par un user, triés par count desc.
-- Tie-break : updated_at desc (l'emoji utilisé plus récemment passe devant
-- en cas d'égalité de count → reflète mieux la préférence actuelle).
create or replace function public.get_user_top_emojis(
  p_user_id uuid,
  p_limit   integer default 3
)
returns table (emoji text, count integer)
language sql
stable
security invoker  -- pas besoin de definer : RLS user_emoji_stats_select_self gère le filtre.
set search_path = public
as $$
  select s.emoji, s.count
  from public.user_emoji_stats s
  where s.user_id = p_user_id
  order by s.count desc, s.updated_at desc
  limit greatest(p_limit, 1);
$$;

comment on function public.get_user_top_emojis(uuid, integer) is
  'Top N emojis utilisés par un user, triés par count desc + updated_at desc. '
  'Lecture protégée par RLS user_emoji_stats_select_self (caller voit '
  'uniquement ses propres stats). Si <N résultats, le caller complète avec '
  'des defaults côté code (cf. useUserTopEmojis hook).';

revoke all on function public.get_user_top_emojis(uuid, integer) from public;
grant execute on function public.get_user_top_emojis(uuid, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- Backfill initial (best-effort)
-- ----------------------------------------------------------------------------
-- On reconstruit le cache à partir des 4 tables de réactions existantes.
-- Si la migration est rejouée, on truncate d'abord pour éviter les doublons.
truncate public.user_emoji_stats;

insert into public.user_emoji_stats (user_id, emoji, count, updated_at)
select user_id, emoji, sum(c) as count, max(updated_at) as updated_at
from (
  select user_id, emoji, count(*) as c, max(created_at) as updated_at
  from public.message_reactions group by user_id, emoji
  union all
  select user_id, emoji, count(*) as c, max(created_at) as updated_at
  from public.comment_reactions group by user_id, emoji
  union all
  select user_id, emoji, count(*) as c, max(created_at) as updated_at
  from public.comment_reply_reactions group by user_id, emoji
  union all
  select user_id, emoji, count(*) as c, max(created_at) as updated_at
  from public.post_reactions group by user_id, emoji
) all_reactions
group by user_id, emoji
on conflict (user_id, emoji) do update
set count = excluded.count, updated_at = excluded.updated_at;

commit;
