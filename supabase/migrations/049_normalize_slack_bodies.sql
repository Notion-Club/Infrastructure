-- ============================================================================
-- 049_normalize_slack_bodies.sql
--
-- Normalise le mrkdwn Slack BRUT des posts/commentaires importés vers le format
-- lu par le renderer communauté (mini-markdown : **gras**, *italique*,
-- [libellé](url), URL nue). Cible EXCLUSIVEMENT les lignes issues de l'import
-- Slack (slack_message_ts IS NOT NULL) ; les posts/commentaires natifs ne sont
-- jamais touchés.
--
-- Conversions déterministes couvertes ici :
--   *x*              -> **x**            (gras Slack 1 astérisque -> gras markdown 2)
--   _x_              -> *x*              (italique Slack -> italique markdown)
--   <url|libellé>    -> [libellé](url)   (lien Slack libellé)
--   <url>            -> url              (lien Slack nu -> URL nue, linkify s'en charge)
--   &amp; &lt; &gt;  -> & < >            (déséchappement des entités Slack)
--
-- Les mentions Slack `<@Uxxxx>` NE SONT PAS traitées ici : leur résolution en
-- `@Nom` + peuplement de post_mentions/comment_mentions nécessite un mapping
-- slack_user_id -> profil, réalisé par le script Node idempotent
-- `scripts/resolve-slack-mentions.mjs` (à lancer APRÈS cette migration).
--
-- IDEMPOTENCE : le body normalisé est DÉRIVÉ à chaque exécution de la source
-- immuable `slack_archive.body` (jamais mutée). Rejouer reproduit exactement le
-- même résultat ; le garde `IS DISTINCT FROM` évite tout write (et tout bump de
-- updated_at) sur les lignes déjà normalisées.
--
-- RÉVERSIBILITÉ : la source d'origine reste intacte dans `slack_archive.body`.
-- Rollback = ré-appliquer le body brut :
--     update public.posts p set body = sa.body
--       from public.slack_archive sa
--      where p.slack_message_ts = sa.slack_message_ts and p.slack_message_ts is not null;
--     update public.comments c set body = sa.body
--       from public.slack_archive sa
--      where c.slack_message_ts = sa.slack_message_ts and c.slack_message_ts is not null;
--
-- DÉPENDANCE / ENVIRONNEMENT : requiert la table `slack_archive` et les colonnes
-- de lineage `posts.slack_message_ts` / `comments.slack_message_ts` (créées par
-- l'import Slack, appliqué hors-repo). La partie données est GARDÉE : si ces
-- objets sont absents (ex. Preview, `db reset`), la migration crée seulement la
-- fonction et ignore l'UPDATE (no-op) au lieu d'échouer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Fonction de conversion déterministe. IMMUTABLE : dépend uniquement de l'entrée.
-- Ordre : 1. liens (vrais <>)  2. gras (*)  3. italique (_)  4. entités (fin).
-- Le gras est converti AVANT l'italique : `_`->`*` produit des `*` qu'il ne faut
-- pas re-promouvoir en gras.
-- ----------------------------------------------------------------------------
create or replace function public.slack_normalize_text(body text)
returns text
language sql
immutable
as $$
  select
    replace(replace(replace(
      regexp_replace(                                        -- 3. italique _x_ -> *x*
        regexp_replace(                                      -- 2. gras *x* -> **x**
          regexp_replace(                                    -- 1b. lien nu <url> -> url
            regexp_replace(                                  -- 1a. lien libellé <url|label> -> [label](url)
              body,
              '<(https?://[^|>]+)\|([^>]+)>', '[\2](\1)', 'g'),
            '<(https?://[^>]+)>', '\1', 'g'),
          '\*([^*' || chr(10) || ']+?)\*', '**\1**', 'g'),
        '_([^_' || chr(10) || ']+?)_', '*\1*', 'g'),
      '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
$$;

comment on function public.slack_normalize_text(text) is
  'Normalise le mrkdwn Slack (gras/italique/liens/entités) vers le mini-markdown du renderer communauté. Ne touche pas les mentions <@Uxxxx> (cf. scripts/resolve-slack-mentions.mjs). Migration 049.';

-- ----------------------------------------------------------------------------
-- DRY-RUN (lecture seule) — à exécuter AVANT l'UPDATE pour visualiser le diff :
--
--   select
--     case when p.id is not null then 'post' else 'comment' end as kind,
--     coalesce(p.id, c.id)                              as target_id,
--     left(sa.body, 200)                                as body_before,
--     left(public.slack_normalize_text(sa.body), 200)   as body_after
--   from public.slack_archive sa
--   left join public.posts p    on p.slack_message_ts = sa.slack_message_ts
--   left join public.comments c on c.slack_message_ts = sa.slack_message_ts
--   where (p.id is not null or c.id is not null)
--     and sa.body is distinct from public.slack_normalize_text(sa.body)
--   limit 30;
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- APPLICATION (gardée) — dérive depuis slack_archive.body (source immuable),
-- garde IS DISTINCT FROM pour n'écrire que les lignes réellement modifiées.
-- No-op si l'infra d'import Slack est absente de cet environnement.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.slack_archive') is null then
    raise notice '049: slack_archive absente — normalisation ignorée (env sans import Slack).';
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'slack_message_ts'
  ) then
    raise notice '049: posts.slack_message_ts absente — normalisation ignorée.';
    return;
  end if;

  execute $u$
    update public.posts p
       set body = public.slack_normalize_text(sa.body)
      from public.slack_archive sa
     where p.slack_message_ts = sa.slack_message_ts
       and p.slack_message_ts is not null
       and p.body is distinct from public.slack_normalize_text(sa.body)
  $u$;

  execute $u$
    update public.comments c
       set body = public.slack_normalize_text(sa.body)
      from public.slack_archive sa
     where c.slack_message_ts = sa.slack_message_ts
       and c.slack_message_ts is not null
       and c.body is distinct from public.slack_normalize_text(sa.body)
  $u$;
end $$;
