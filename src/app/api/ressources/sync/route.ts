// POST /api/ressources/sync — synchronise les ressources & templates Notion → Supabase.
//
// Autorisé pour :
//   - un admin authentifié (session Supabase, profiles.role = 'admin'), ou
//   - un appel machine portant `Authorization: Bearer <CRON_SECRET>`.
//
// N'expose jamais le service_role : la sync l'utilise en interne.
import { NextRequest, NextResponse } from "next/server";

import { isCronRequest } from "@/shared/lib/auth/cron";
import { isRequestAdmin } from "@/shared/lib/auth/requireAdmin";
import { syncRessourcesFromNotion } from "@/modules/ressources/server/sync";

export async function POST(request: NextRequest) {
  if (!(isCronRequest(request) || (await isRequestAdmin()))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  try {
    const report = await syncRessourcesFromNotion();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[ressources/sync] error:", err);
    const message = err instanceof Error ? err.message : "Erreur interne de sync";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
