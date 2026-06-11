// Synchronisation Notion → Supabase (cache des ressources & templates).
//
// Upsert idempotent par notion_id via le client admin (bypass RLS — écriture
// de structure réservée au service_role).
//
// Stratégie :
//   1. Pull la liste légère depuis Notion (fetchResources + fetchTemplates)
//      → métadonnées uniquement (pas de body, déjà comme ça côté Notion fetch).
//   2. Pour chaque resource (category='resource'), pull le body en blocs
//      via fetchResourceBySlug. Lent (1 call /page + 1 call /blocks/children
//      par ressource) mais on synchronise quelques dizaines de ressources max.
//   3. Upsert resources par notion_id (idempotent).
//   4. Optionnel : ne PAS supprimer les ressources retirées de Notion — on
//      garde l'historique en cache. Si Théo veut purger, on ajoutera une
//      passe "soft delete" plus tard.
//
// Déclenché par /api/ressources/sync (protégé par admin OU CRON_SECRET).

import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";
import {
  fetchResources,
  fetchResourceBySlug,
  fetchTemplates,
  slugToNotionId,
} from "../lib/notion";

export type RessourcesSyncReport = {
  resources: { fetched: number; upserted: number; failed: number };
  templates: { fetched: number; upserted: number; failed: number };
  startedAt: string;
  finishedAt: string;
};

export async function syncRessourcesFromNotion(): Promise<RessourcesSyncReport> {
  const startedAt = new Date().toISOString();
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // ── 1. Resources (avec body) ────────────────────────────────────
  const resourceListing = await fetchResources();
  let resourcesUpserted = 0;
  let resourcesFailed = 0;

  for (const meta of resourceListing) {
    // Re-pull individuellement pour récupérer le body (content blocks).
    // fetchResources() ne retourne pas le body — c'est par design côté Notion lib.
    const full = await fetchResourceBySlug(meta.slug);
    if (!full) {
      resourcesFailed += 1;
      continue;
    }

    const notionId = slugToNotionId(full.slug);

    // Snapshot de l'ancien content avant écrasement (single-version backup).
    // Sur un insert (ligne absente), content_backup reste null.
    const { data: existing } = await admin
      .from("resources")
      .select("content")
      .eq("notion_id", notionId)
      .maybeSingle<{ content: unknown }>();

    const { error } = await admin.from("resources").upsert(
      {
        notion_id: notionId,
        slug: full.slug,
        category: "resource",
        titre: full.titre,
        description: full.description || null,
        visibilite: full.visibilite,
        formation: full.formation,
        type: full.type,
        content: full.content,
        ...(existing ? { content_backup: existing.content } : {}),
        url_notion_public_page: null,
        url_tella: null,
        date_creation: full.dateCreation,
        synced_at: now,
      },
      { onConflict: "notion_id" },
    );
    if (error) {
      console.error(`[ressources/sync] resource "${full.titre}" failed:`, error.message);
      resourcesFailed += 1;
    } else {
      resourcesUpserted += 1;
    }
  }

  // ── 2. Templates (pas de body, just metadata) ────────────────────
  const templateListing = await fetchTemplates();
  let templatesUpserted = 0;
  let templatesFailed = 0;

  for (const tpl of templateListing) {
    const { error } = await admin.from("resources").upsert(
      {
        notion_id: slugToNotionId(tpl.slug),
        slug: tpl.slug,
        category: "template",
        titre: tpl.titre,
        description: tpl.description || null,
        visibilite: tpl.visibilite,
        formation: [],
        type: [tpl.type],
        content: null,
        url_notion_public_page: tpl.urlNotionPublicPage,
        url_tella: tpl.urlTella ?? null,
        date_creation: tpl.dateCreation,
        synced_at: now,
      },
      { onConflict: "notion_id" },
    );
    if (error) {
      console.error(`[ressources/sync] template "${tpl.titre}" failed:`, error.message);
      templatesFailed += 1;
    } else {
      templatesUpserted += 1;
    }
  }

  return {
    resources: {
      fetched: resourceListing.length,
      upserted: resourcesUpserted,
      failed: resourcesFailed,
    },
    templates: {
      fetched: templateListing.length,
      upserted: templatesUpserted,
      failed: templatesFailed,
    },
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
