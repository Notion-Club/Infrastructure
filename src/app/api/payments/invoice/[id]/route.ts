// Invoice proxy — GET renvoie le PDF de la facture d'UN paiement précis,
// identifié par l'ID de page Notion (`notionId` exposé par /api/payments/me).
//
// 🔴 ROUTE SENSIBLE — review ligne par ligne obligatoire (risque IDOR).
//    Sans le contrôle d'ownership ci-dessous, n'importe quel membre
//    authentifié pourrait lire la facture d'un autre en devinant un ID de page.
//
// Ordre de traitement (NON négociable) :
//   1. Auth          — supabase.auth.getUser() sinon 401.
//   2. Ownership      — la page Notion [id] doit appartenir au membre courant
//                       (relation `Membre` == profiles.notion_member_page_id).
//                       Sinon → 404 (jamais 403 : on ne confirme pas l'existence
//                       de la facture d'autrui).
//   3. URL fraîche    — on relit la propriété `Facture` à CHAQUE requête. Les
//                       fichiers Notion renvoient une URL S3 pré-signée qui
//                       expire (~1h) ; on ne stocke donc jamais l'URL, l'ID de
//                       page est l'identifiant stable, l'URL est recalculée.
//   4. Proxy/stream   — le serveur télécharge le PDF et le stream au client.
//                       L'URL Notion/S3 n'apparaît JAMAIS dans la réponse réseau
//                       (règle #132 : Notion ne doit pas fuiter côté client).
//
// Mode : `?download=1` force le téléchargement (Content-Disposition: attachment),
// sinon affichage inline (ouverture dans un onglet / embed).
//
// Lecture seule. `force-dynamic` + `cache: "no-store"` partout.

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

// DB Paiements (même défaut que /api/payments/me). Override staging via env.
const PAYMENTS_DATABASE_ID = "2a1bad05-6a95-80cc-b34d-c3bc28ad2d1d";

// ───────────────────────────────────────────────────────────────────────────
// Types Notion partiels (on reste permissif : base éditée à la main par l'admin).

interface NotionFilesProp {
  files?: Array<{
    file?: { url?: string };
    external?: { url?: string };
    name?: string;
  }>;
}
interface NotionUrlProp {
  url?: string | null;
}
interface NotionTitleProp {
  title?: Array<{ plain_text?: string; text?: { content?: string } }>;
}
interface NotionRelationProp {
  relation?: Array<{ id?: string }>;
}

interface NotionPage {
  parent?: { database_id?: string };
  properties?: {
    Nom?: NotionTitleProp;
    Membre?: NotionRelationProp;
    Facture?: NotionFilesProp & NotionUrlProp;
  };
}

// Normalise un ID Notion pour comparaison (32 hex, sans tirets, minuscule).
function normId(id: string | null | undefined): string {
  return (id ?? "").replace(/-/g, "").toLowerCase();
}

// Extrait l'URL de la facture (Files → file.url / external.url, sinon URL).
// Identique à readInvoiceUrl de /api/payments/me — re-résolue à chaque requête.
function readInvoiceUrl(prop?: NotionFilesProp & NotionUrlProp): string | null {
  if (!prop) return null;
  const f = prop.files?.[0];
  return f?.file?.url ?? f?.external?.url ?? prop.url ?? null;
}

function readTitle(prop?: NotionTitleProp): string {
  const first = prop?.title?.[0];
  return first?.plain_text ?? first?.text?.content ?? "";
}

// Nom de fichier ASCII sûr pour Content-Disposition (fallback). Le nom complet
// (accents inclus) part dans filename* en RFC 5987.
function asciiFilename(label: string): string {
  const base =
    label
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/["\\\r\n]/g, "")
      .trim() || "facture";
  return `${base}.pdf`;
}

// 404 neutre : ne JAMAIS confirmer l'existence d'une facture qui n'appartient
// pas au membre courant (anti-IDOR / anti-énumération).
function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // ── 1. Auth ────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const token = process.env.NOTION_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Configuration serveur manquante (NOTION_API_TOKEN)" },
      { status: 500 },
    );
  }

  // Garde-fou format : un ID de page Notion = 32 hex (avec ou sans tirets).
  // Rejeter tout le reste avant tout appel réseau (anti-SSRF / garbage).
  const pageId = normId(id);
  if (!/^[0-9a-f]{32}$/.test(pageId)) return notFound();

  // ── 2a. Membre courant — lecture directe du profil (pas de side-effect).
  // On NE crée PAS de page Notion ici (route lecture seule) : sans
  // notion_member_page_id, l'user ne possède aucune facture → 404.
  const { data: profile } = await supabase
    .from("profiles")
    .select("notion_member_page_id")
    .eq("id", authData.user.id)
    .maybeSingle<{ notion_member_page_id: string | null }>();

  const memberPageId = normId(profile?.notion_member_page_id);
  if (!memberPageId) return notFound();

  // ── 2b. Résolution de la page Notion + contrôle d'ownership ──────────────
  let page: NotionPage;
  try {
    const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
      cache: "no-store",
    });
    // Notion renvoie 404 (object_not_found) si la page n'existe pas / n'est pas
    // partagée avec l'intégration → 404 neutre côté client.
    if (!pageRes.ok) return notFound();
    page = (await pageRes.json()) as NotionPage;
  } catch (err) {
    console.error("[payments/invoice] notion page fetch error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }

  // Défense en profondeur : la page DOIT appartenir à la DB Paiements. Empêche
  // de pointer une page Notion arbitraire qui aurait une relation « Membre ».
  const expectedDb = normId(
    process.env.NOTION_PAYMENTS_DATABASE_ID ?? PAYMENTS_DATABASE_ID,
  );
  if (normId(page.parent?.database_id) !== expectedDb) return notFound();

  // Le cœur anti-IDOR : la relation « Membre » du paiement doit contenir la
  // page Membre du user courant. Sinon → 404 (on ne révèle rien).
  const ownsInvoice = (page.properties?.Membre?.relation ?? []).some(
    (r) => normId(r.id) === memberPageId,
  );
  if (!ownsInvoice) return notFound();

  // ── 3. Re-résolution de l'URL fraîche (jamais stockée) ───────────────────
  const invoiceUrl = readInvoiceUrl(page.properties?.Facture);
  if (!invoiceUrl) return notFound();

  // ── 4. Proxy/stream — l'URL Notion ne fuite jamais côté client ───────────
  let upstream: Response;
  try {
    upstream = await fetch(invoiceUrl, { cache: "no-store" });
  } catch (err) {
    console.error("[payments/invoice] upstream fetch error:", err);
    return NextResponse.json(
      { error: "Facture momentanément indisponible" },
      { status: 502 },
    );
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Facture momentanément indisponible" },
      { status: 502 },
    );
  }

  const download =
    new URL(request.url).searchParams.get("download") === "1";
  const label = readTitle(page.properties?.Nom) || "facture";
  const ascii = asciiFilename(label);
  const utf8 = encodeURIComponent(`${label}.pdf`);

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? "application/pdf",
  );
  headers.set(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${utf8}`,
  );
  headers.set("Cache-Control", "no-store");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new Response(upstream.body, { status: 200, headers });
}
