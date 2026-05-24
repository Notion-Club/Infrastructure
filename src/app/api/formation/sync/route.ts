// POST /api/formation/sync — synchronise la structure Notion → Supabase.
//
// Autorisé pour :
//   - un admin authentifié (session Supabase, profiles.role = 'admin'), ou
//   - un appel machine portant `Authorization: Bearer <CRON_SECRET>`
//     (webhook Notion / cron Vercel — automatisation ultérieure).
//
// N'expose jamais le service_role : la sync l'utilise en interne.
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { syncFormationsFromNotion } from "@/modules/formation/server/sync";
import { NotionError } from "@/shared/lib/notion/client";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Voie machine : Bearer CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  // Voie admin : session Supabase avec role admin
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  return profile?.role === "admin";
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
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
