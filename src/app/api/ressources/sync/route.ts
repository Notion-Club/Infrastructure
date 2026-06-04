// POST /api/ressources/sync — synchronise les ressources & templates Notion → Supabase.
//
// Autorisé pour :
//   - un admin authentifié (session Supabase, profiles.role = 'admin'), ou
//   - un appel machine portant `Authorization: Bearer <CRON_SECRET>`.
//
// N'expose jamais le service_role : la sync l'utilise en interne.
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { syncRessourcesFromNotion } from "@/modules/ressources/server/sync";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

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
    const report = await syncRessourcesFromNotion();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[ressources/sync] error:", err);
    const message = err instanceof Error ? err.message : "Erreur interne de sync";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
