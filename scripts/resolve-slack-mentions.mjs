#!/usr/bin/env node
// ============================================================================
// resolve-slack-mentions.mjs
//
// Résout les mentions Slack brutes `<@Uxxxx>` en `@Nom` dans les posts/comments
// importés, et peuple post_mentions / comment_mentions avec le profil résolu.
// Complète la migration 049 (qui gère gras/italique/liens) — LANCER APRÈS elle.
//
// Idempotent : une fois `<@Uxxxx>` remplacé par `@Nom`, un nouveau passage ne
// trouve plus rien à remplacer ; les mentions déjà présentes ne sont pas
// réinsérées (dédup en mémoire vs l'existant).
//
// Résolution du mapping slack_user_id -> profil : reconstruite depuis la donnée
// d'origine, en croisant slack_archive (slack_user_id de l'auteur) avec le
// post/comment importé correspondant (author_id = profil résolu à l'import).
// Un utilisateur uniquement MENTIONNÉ (jamais auteur d'un message importé) reste
// non résolu -> `<@Uxxxx>` laissé tel quel (acceptable, non cassé).
//
// SÉCURITÉ : nécessite le service_role (bypass RLS). Par défaut DRY-RUN (n'écrit
// rien) ; passer --apply pour appliquer. Cible UNIQUEMENT slack_message_ts NOT NULL.
//
// ⚠️ Au moment de l'écriture, ces données n'existent que sur le projet Prod
// (Preview ne contient ni slack_archive ni les lignes importées).
//
// Usage :
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/resolve-slack-mentions.mjs            # dry-run (défaut)
//   ... node scripts/resolve-slack-mentions.mjs --apply  # applique
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const MENTION_RE = /<@(U[A-Z0-9]+)>/g;

// Réplique EXACTE de computeDisplayName (src/modules/community/server/queries.ts)
// pour que le texte `@Nom` inséré matche le name résolu au rendu.
function computeDisplayName(p) {
  const fn = p.first_name?.trim();
  const ln = p.last_name?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  if (fn) return fn;
  if (ln) return ln;
  return p.display_name?.trim() || p.username || "Utilisateur";
}

async function fetchAll(table, columns, filter) {
  // Pagination simple (1000/page) pour ne rien tronquer.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function main() {
  console.log(`Mode : ${APPLY ? "APPLY (écriture)" : "DRY-RUN (aucune écriture)"}`);

  const [archive, profiles, posts, comments, existingPostM, existingCommentM] =
    await Promise.all([
      fetchAll("slack_archive", "slack_message_ts, slack_user_id"),
      fetchAll("profiles", "id, first_name, last_name, display_name, username"),
      fetchAll("posts", "id, author_id, body, slack_message_ts", (q) =>
        q.not("slack_message_ts", "is", null)),
      fetchAll("comments", "id, author_id, body, slack_message_ts", (q) =>
        q.not("slack_message_ts", "is", null)),
      fetchAll("post_mentions", "post_id, mentioned_user_id"),
      fetchAll("comment_mentions", "comment_id, mentioned_user_id"),
    ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const authorByTs = new Map(); // slack_message_ts -> author_id (profil)
  for (const p of posts) authorByTs.set(p.slack_message_ts, p.author_id);
  for (const c of comments) authorByTs.set(c.slack_message_ts, c.author_id);

  // Mapping slack_user_id -> profile_id, reconstruit via les messages importés.
  const profileBySlackUid = new Map();
  for (const a of archive) {
    const authorId = authorByTs.get(a.slack_message_ts);
    if (authorId && !profileBySlackUid.has(a.slack_user_id)) {
      profileBySlackUid.set(a.slack_user_id, authorId);
    }
  }

  // Index des mentions déjà présentes (dédup).
  const seenPostM = new Set(existingPostM.map((m) => `${m.post_id}|${m.mentioned_user_id}`));
  const seenCommentM = new Set(existingCommentM.map((m) => `${m.comment_id}|${m.mentioned_user_id}`));

  const stats = { scanned: 0, bodiesChanged: 0, mentionsInserted: 0, unresolved: new Set() };

  async function processRow(kind, row) {
    const idCol = kind === "post" ? "post_id" : "comment_id";
    const table = kind === "post" ? "posts" : "comments";
    const mentionTable = kind === "post" ? "post_mentions" : "comment_mentions";
    const seen = kind === "post" ? seenPostM : seenCommentM;

    if (!row.body || !MENTION_RE.test(row.body)) return;
    MENTION_RE.lastIndex = 0;
    stats.scanned++;

    const mentionedProfileIds = new Set();
    const newBody = row.body.replace(MENTION_RE, (full, uid) => {
      const profileId = profileBySlackUid.get(uid);
      if (!profileId) {
        stats.unresolved.add(uid);
        return full; // non résolu -> laissé tel quel
      }
      const prof = profileById.get(profileId);
      if (!prof) {
        stats.unresolved.add(uid);
        return full;
      }
      mentionedProfileIds.add(profileId);
      return `@${computeDisplayName(prof)}`;
    });

    // Insertion des mentions manquantes.
    const toInsert = [];
    for (const pid of mentionedProfileIds) {
      const key = `${row.id}|${pid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      toInsert.push({ [idCol]: row.id, mentioned_user_id: pid });
    }

    if (newBody !== row.body) {
      stats.bodiesChanged++;
      if (APPLY) {
        const { error } = await db.from(table).update({ body: newBody }).eq("id", row.id);
        if (error) throw new Error(`update ${table} ${row.id}: ${error.message}`);
      }
    }
    if (toInsert.length > 0) {
      stats.mentionsInserted += toInsert.length;
      if (APPLY) {
        const { error } = await db.from(mentionTable).insert(toInsert);
        if (error) throw new Error(`insert ${mentionTable}: ${error.message}`);
      }
    }
  }

  for (const p of posts) await processRow("post", p);
  for (const c of comments) await processRow("comment", c);

  console.log(`Lignes avec mentions scannées : ${stats.scanned}`);
  console.log(`Bodies modifiés            : ${stats.bodiesChanged}`);
  console.log(`Mentions à insérer         : ${stats.mentionsInserted}`);
  console.log(`Slack UIDs non résolus     : ${stats.unresolved.size}` +
    (stats.unresolved.size ? ` (${[...stats.unresolved].join(", ")})` : ""));
  if (!APPLY) console.log("\nDRY-RUN — relancer avec --apply pour écrire.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
