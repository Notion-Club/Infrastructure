// Webhook Notion → sync membership Supabase.
//
// Pattern d'invocation côté Notion :
//   - Théo crée une automation dans la DB Membres qui se déclenche quand la
//     propriété Offre OU Date de fin est modifiée.
//   - L'automation appelle POST https://app.notionclub.fr/api/notion-webhooks/members
//     avec un payload JSON et le header X-Notion-Webhook-Secret.
//
// Sécurité :
//   - Header X-Notion-Webhook-Secret comparé en temps constant à
//     NOTION_WEBHOOK_SECRET (env var). Pas de hash HMAC car les automations
//     Notion ne signent pas le body (limite produit Notion à ce jour).
//   - Le secret doit être généré par nous (openssl rand -hex 32) et configuré
//     à la fois côté Vercel ET dans l'automation Notion.
//
// Payload attendu :
//   {
//     "notion_member_page_id": "159bad05-...",
//     "offre": "Formation uniquement" | "Accompagnement" | null,
//     "date_de_fin": "2026-12-31" | null
//   }
//
// Best-effort : on retourne 200 même si le profil n'existe pas (Notion peut
// envoyer des events sur des membres pas encore liés à un user Supabase).
// On retourne 400/401/500 uniquement sur erreur technique.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { syncMembershipFromNotion } from "@/modules/auth/server/syncMembership";

export const dynamic = "force-dynamic";

interface WebhookPayload {
  notion_member_page_id?: unknown;
  offre?: unknown;
  date_de_fin?: unknown;
}

function parsePayload(raw: unknown):
  | {
      ok: true;
      notionMemberPageId: string;
      offre: string | null;
      dateDeFin: string | null;
    }
  | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "Body is not an object" };
  }
  const p = raw as WebhookPayload;

  if (typeof p.notion_member_page_id !== "string" || !p.notion_member_page_id) {
    return { ok: false, reason: "Missing or invalid notion_member_page_id" };
  }

  const offre =
    typeof p.offre === "string" && p.offre.length > 0 ? p.offre : null;
  const dateDeFin =
    typeof p.date_de_fin === "string" && p.date_de_fin.length > 0
      ? p.date_de_fin
      : null;

  return {
    ok: true,
    notionMemberPageId: p.notion_member_page_id,
    offre,
    dateDeFin,
  };
}

// Comparaison constant-time du secret pour éviter une attaque timing-based
// (un attaquant qui essaie des secrets et mesure le temps de réponse).
function safeCompareSecret(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.NOTION_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("[notion-webhooks/members] NOTION_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const providedSecret = req.headers.get("x-notion-webhook-secret") ?? "";
  if (!safeCompareSecret(providedSecret, expectedSecret)) {
    // 401 explicite — utile pour Théo qui debug l'automation côté Notion.
    return NextResponse.json(
      { error: "Invalid webhook secret" },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parsePayload(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.reason }, { status: 400 });
  }

  try {
    const result = await syncMembershipFromNotion({
      notionMemberPageId: parsed.notionMemberPageId,
      offre: parsed.offre,
      dateDeFin: parsed.dateDeFin,
    });

    // Log structuré pour debug — apparaît dans les logs Vercel.
    console.log(
      "[notion-webhooks/members] sync",
      JSON.stringify({
        notionPageId: parsed.notionMemberPageId,
        offre: parsed.offre,
        dateDeFin: parsed.dateDeFin,
        result,
      }),
    );

    // On retourne 200 même sur les cas "no_profile_found" / "unknown_offer" —
    // Notion arrêterait de retry sinon, et ces cas ne sont pas des erreurs
    // techniques mais des états attendus.
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error(
      "[notion-webhooks/members] sync failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 },
    );
  }
}
