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

// Le format du body envoyé par Notion automations dépend de la version de
// Notion et de comment l'admin coche les properties. On accepte plusieurs
// formats :
//
//   FORMAT A — Custom body (notre format initial, plus dispo dans Notion v3) :
//     { notion_member_page_id, offre, date_de_fin }
//
//   FORMAT B — Notion native "Send webhook" (UI Automation actuelle) :
//     {
//       "data": {
//         "id": "<page id>",
//         "properties": {
//           "Offre": { "type": "select", "select": { "name": "..." } },
//           "Date de fin": { "type": "formula", "formula": { "string": "..." } },
//           ...
//         }
//       },
//       ... (autres metadata Notion : "source", "page", etc.)
//     }
//
//   FORMAT C — Notion native flat (variante observée parfois) :
//     {
//       "id": "<page id>",
//       "properties": { ... pareil ... }
//     }
//
// On essaie A en premier, puis B/C en fallback.
interface CustomBody {
  notion_member_page_id?: unknown;
  offre?: unknown;
  date_de_fin?: unknown;
}

type NotionProp = Record<string, unknown>;

function readNotionProperty(props: Record<string, unknown>, key: string): unknown {
  const p = props[key];
  if (!p || typeof p !== "object") return null;
  return p;
}

function readSelectName(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null;
  const p = prop as NotionProp;
  const sel = p.select;
  if (sel && typeof sel === "object" && "name" in sel) {
    const name = (sel as { name: unknown }).name;
    return typeof name === "string" && name.length > 0 ? name : null;
  }
  return null;
}

function readDateOrFormulaString(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null;
  const p = prop as NotionProp;
  // Formula returning a string (cas de "Date de fin" qui est une formula
  // calculant dateSignature + dureeJours).
  if (p.formula && typeof p.formula === "object") {
    const f = p.formula as { type?: string; string?: string; date?: { start?: string } };
    if (typeof f.string === "string" && f.string.length > 0) return f.string;
    if (f.date && typeof f.date.start === "string") return f.date.start;
  }
  // Date directe.
  if (p.date && typeof p.date === "object") {
    const d = p.date as { start?: string };
    if (typeof d.start === "string") return d.start;
  }
  return null;
}

function parsePayload(raw: unknown):
  | {
      ok: true;
      notionMemberPageId: string;
      offre: string | null;
      dateDeFin: string | null;
      format: "custom" | "notion_native";
    }
  | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "Body is not an object" };
  }

  // ── FORMAT A : custom body ─────────────────────────────────────────────
  const a = raw as CustomBody;
  if (typeof a.notion_member_page_id === "string" && a.notion_member_page_id) {
    const offre =
      typeof a.offre === "string" && a.offre.length > 0 ? a.offre : null;
    const dateDeFin =
      typeof a.date_de_fin === "string" && a.date_de_fin.length > 0
        ? a.date_de_fin
        : null;
    return {
      ok: true,
      notionMemberPageId: a.notion_member_page_id,
      offre,
      dateDeFin,
      format: "custom",
    };
  }

  // ── FORMAT B / C : Notion native ───────────────────────────────────────
  // On cherche `data.id` + `data.properties` ou directement `id` + `properties`.
  const root = raw as Record<string, unknown>;
  const dataNode =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null;
  const candidate = dataNode ?? root;

  const pageId = typeof candidate.id === "string" ? candidate.id : null;
  const properties =
    candidate.properties && typeof candidate.properties === "object"
      ? (candidate.properties as Record<string, unknown>)
      : null;

  if (pageId && properties) {
    const offre = readSelectName(readNotionProperty(properties, "Offre"));
    const dateDeFin = readDateOrFormulaString(
      readNotionProperty(properties, "Date de fin"),
    );
    return {
      ok: true,
      notionMemberPageId: pageId,
      offre,
      dateDeFin,
      format: "notion_native",
    };
  }

  return {
    ok: false,
    reason:
      "Unrecognized body shape — expected custom { notion_member_page_id, offre, date_de_fin } or Notion native { data: { id, properties } }",
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

  // Notion automations refuse les tirets dans le nom des headers custom via
  // son UI, donc on lit toutes les variantes plausibles (avec/sans tirets,
  // avec/sans préfixe X-) pour rester robuste.
  const providedSecret =
    req.headers.get("x-notion-webhook-secret") ??
    req.headers.get("xnotionwebhooksecret") ??
    req.headers.get("notion-webhook-secret") ??
    req.headers.get("notionwebhooksecret") ??
    req.headers.get("x-webhook-secret") ??
    req.headers.get("webhook-secret") ??
    "";
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
    // Log du body brut quand le parsing échoue — utile pour ajuster le
    // parser si Notion change son format. Cap 4kb pour ne pas exploser
    // les logs Vercel.
    const rawDump = JSON.stringify(raw).slice(0, 4000);
    console.error(
      "[notion-webhooks/members] parse failed:",
      parsed.reason,
      "raw body:",
      rawDump,
    );
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
        format: parsed.format,
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
