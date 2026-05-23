// Synchronisation Notion → Supabase (cache de structure).
//
// Upsert idempotent des formations / modules / cours dans Supabase via le
// client admin (bypass RLS — écriture de structure réservée au service_role).
// N'écrit QUE les métadonnées légères, jamais le body des cours.
//
// Déclenché par /api/formation/sync (protégé). Peut être branché plus tard
// sur le webhook Notion ou un cron Vercel.

import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";
import { fetchFormationsTree, slugify } from "./notion";

export type SyncReport = {
  formations: number;
  modules: number;
  courses: number;
  startedAt: string;
  finishedAt: string;
};

export async function syncFormationsFromNotion(): Promise<SyncReport> {
  const startedAt = new Date().toISOString();
  const tree = await fetchFormationsTree();
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  let formationCount = 0;
  let moduleCount = 0;
  let courseCount = 0;

  for (const formation of tree) {
    // 1. Formation
    const { data: fRow, error: fErr } = await admin
      .from("formations")
      .upsert(
        {
          notion_id: formation.notionId,
          slug: slugify(formation.name) || formation.notionId,
          name: formation.name,
          description: formation.description || null,
          position: formation.position,
          synced_at: now,
        },
        { onConflict: "notion_id" },
      )
      .select("id")
      .single();

    if (fErr || !fRow) {
      throw new Error(
        `Sync formation "${formation.name}" échouée: ${fErr?.message ?? "no row"}`,
      );
    }
    const formationId = fRow.id;
    formationCount++;

    for (const mod of formation.modules) {
      // 2. Module
      const { data: mRow, error: mErr } = await admin
        .from("formation_modules")
        .upsert(
          {
            notion_id: mod.notionId,
            formation_id: formationId,
            name: mod.name,
            position: mod.position,
            cover_url: mod.coverUrl,
            synced_at: now,
          },
          { onConflict: "notion_id" },
        )
        .select("id")
        .single();

      if (mErr || !mRow) {
        throw new Error(
          `Sync module "${mod.name}" échouée: ${mErr?.message ?? "no row"}`,
        );
      }
      const moduleId = mRow.id;
      moduleCount++;

      // 3. Cours du module
      if (mod.courses.length === 0) continue;
      const { error: cErr } = await admin.from("formation_courses").upsert(
        mod.courses.map((c) => ({
          notion_id: c.notionId,
          module_id: moduleId,
          formation_id: formationId,
          name: c.name,
          description: c.description || null,
          position: c.position,
          is_default: c.isDefault,
          synced_at: now,
        })),
        { onConflict: "notion_id" },
      );

      if (cErr) {
        throw new Error(
          `Sync cours du module "${mod.name}" échouée: ${cErr.message}`,
        );
      }
      courseCount += mod.courses.length;
    }
  }

  return {
    formations: formationCount,
    modules: moduleCount,
    courses: courseCount,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
