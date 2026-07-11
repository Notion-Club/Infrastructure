// POST /api/formation/sync — synchronise la structure Notion → Supabase.
//
// Autorisé pour :
//   - un admin authentifié (session Supabase, profiles.role = 'admin'), ou
//   - un appel machine portant `Authorization: Bearer <CRON_SECRET>`
//     (webhook Notion / cron Vercel — automatisation ultérieure).
//
// N'expose jamais le service_role : la sync l'utilise en interne.
import { NextRequest, NextResponse } from "next/server";

import { isCronRequest } from "@/shared/lib/auth/cron";
import { isRequestAdmin } from "@/shared/lib/auth/requireAdmin";
import { syncFormationsFromNotion } from "@/modules/formation/server/sync";
import { NotionError } from "@/shared/lib/notion/client";

export async function POST(request: NextRequest) {
  if (!(isCronRequest(request) || (await isRequestAdmin()))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  try {
    const report = await syncFormationsFromNotion();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    if (err instanceof NotionError) {
      console.error("[formation/sync] Notion error:", err.status, err.message);
      return NextResponse.json(
        {
          error:
            err.status === 404
              ? "Base Notion introuvable — l'intégration NOTION_API_TOKEN est-elle connectée aux bases Formations / Modules / Cours ?"
              : `Notion: ${err.message}`,
        },
        { status: 502 },
      );
    }
    console.error("[formation/sync] error:", err);
    return NextResponse.json({ error: "Erreur interne de sync" }, { status: 500 });
  }
}
