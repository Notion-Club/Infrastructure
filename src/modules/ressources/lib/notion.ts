// Server-only fetchers for Notion-backed Ressources & Templates.
// Auth: NOTION_API_TOKEN env var (already configured for the feedback widget — Brique 4).
// The Notion integration MUST be connected to both databases — open each DB in
// Notion → "..." → Connections → add the NotionClub integration. Without that,
// Notion returns 404 "object_not_found".
//
// - Resources DB: 147bad056a9580e69178ded1262ab4d7
// - Templates DB: 176bad056a95800293cbc3f4ad63562f

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  Resource,
  Template,
  ResourceFormation,
  ResourceMetierType,
  ResourceVisibility,
  TemplateType,
} from "../types";
import { routePrefetchedTree } from "@/shared/lib/notion/router";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const REVALIDATE_SECONDS = 60;

const RESOURCES_DB_ID = "147bad056a9580e69178ded1262ab4d7";
const TEMPLATES_DB_ID = "176bad056a95800293cbc3f4ad63562f";

function notionHeaders() {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) {
    throw new Error("NOTION_API_TOKEN missing");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// ─── ID / slug helpers ──────────────────────────────────────────────
// Notion page IDs are 36-char UUIDs with dashes. We use a dashless 32-char
// form in URLs (shorter + same form Notion itself accepts).

function notionIdToSlug(id: string): string {
  return id.replace(/-/g, "");
}

export function slugToNotionId(slug: string): string {
  if (slug.length !== 32) return slug;
  return `${slug.slice(0, 8)}-${slug.slice(8, 12)}-${slug.slice(12, 16)}-${slug.slice(16, 20)}-${slug.slice(20)}`;
}

// ─── Property extractors ────────────────────────────────────────────

function getTitle(prop: any): string {
  return prop?.title?.map((t: any) => t.plain_text).join("") ?? "";
}
function getRichText(prop: any): string {
  return prop?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
}
function getSelect(prop: any): string | null {
  return prop?.select?.name ?? null;
}
function getMultiSelect(prop: any): string[] {
  return (prop?.multi_select ?? []).map((o: any) => o.name);
}
function getUrl(prop: any): string | null {
  return prop?.url ?? null;
}

// ─── Resources ──────────────────────────────────────────────────────

export async function fetchResources(): Promise<Resource[]> {
  const res = await fetch(`${NOTION_API}/databases/${RESOURCES_DB_ID}/query`, {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        property: "Rédaction",
        status: { equals: "En diffusion" },
      },
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    }),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    console.error("[notion] fetchResources failed", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return (data.results ?? []).map(notionPageToResource);
}

function notionPageToResource(page: any): Resource {
  const p = page.properties ?? {};
  return {
    category: "resource",
    slug: notionIdToSlug(page.id),
    titre: getTitle(p["Titre"]),
    description: getRichText(p["Description"]),
    formation: getMultiSelect(p["Formation"]) as ResourceFormation[],
    type: getMultiSelect(p["Type"]) as ResourceMetierType[],
    visibilite: (getSelect(p["Visibilité"]) ?? "Challenge Gratuit") as ResourceVisibility,
    dateCreation: page.created_time,
    content: [],
  };
}

export async function fetchResourceBySlug(slug: string): Promise<Resource | null> {
  const pageId = slugToNotionId(slug);
  const [pageRes, blocks] = await Promise.all([
    fetch(`${NOTION_API}/pages/${pageId}`, {
      headers: notionHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    }),
    fetchAllBlocks(pageId),
  ]);

  if (!pageRes.ok) {
    if (pageRes.status !== 404) {
      console.error("[notion] fetchResourceBySlug failed", pageRes.status);
    }
    return null;
  }
  const page = await pageRes.json();
  const resource = notionPageToResource(page);
  // Normalisation via le routeur Notion unifié (rich text complet + tous types
  // de blocs). On passe l'arbre déjà fetché (avec `_children`) — zéro appel
  // réseau supplémentaire, le caching ISR du fetcher ci-dessus est préservé.
  resource.content = await routePrefetchedTree(blocks);
  return resource;
}

// ─── Templates ──────────────────────────────────────────────────────

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch(`${NOTION_API}/databases/${TEMPLATES_DB_ID}/query`, {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        property: "Conception",
        status: { equals: "Prêt à être dupliqué" },
      },
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    }),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    console.error("[notion] fetchTemplates failed", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return (data.results ?? []).map(notionPageToTemplate);
}

function notionPageToTemplate(page: any): Template {
  const p = page.properties ?? {};
  return {
    category: "template",
    slug: notionIdToSlug(page.id),
    titre: getTitle(p["Name"]),
    description: getRichText(p["Description"]),
    type: (getSelect(p["Type"]) ?? "Système Généraliste") as TemplateType,
    visibilite: (getSelect(p["Visibilité"]) ?? "Challenge Gratuit") as ResourceVisibility,
    urlNotionPublicPage: getUrl(p["URL Notion Public Page"]) ?? "",
    urlTella: getUrl(p["URL Tella"]) ?? undefined,
    dateCreation: page.created_time,
  };
}

export async function fetchTemplateBySlug(slug: string): Promise<Template | null> {
  const pageId = slugToNotionId(slug);
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    headers: notionHeaders(),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    if (res.status !== 404) {
      console.error("[notion] fetchTemplateBySlug failed", res.status);
    }
    return null;
  }
  const page = await res.json();
  return notionPageToTemplate(page);
}

// ─── Block fetch + conversion ────────────────────────────────────────

const MAX_RETRIES = 4;

// Retourne les blocs enfants d'un blockId en suivant la pagination Notion.
// Sur 429 : respecte Retry-After avec backoff exponentiel, jusqu'à MAX_RETRIES.
// Sur tout autre erreur non-2xx : throw (jamais de liste tronquée silencieuse).
async function fetchBlockChildren(blockId: string): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`${NOTION_API}/blocks/${blockId}/children`);
    if (cursor) url.searchParams.set("start_cursor", cursor);

    let res: Response | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      res = await fetch(url.toString(), {
        headers: notionHeaders(),
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (res.status !== 429) break;
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `[ressources/notion] Notion rate-limit (429) sur /blocks/${blockId}/children après ${MAX_RETRIES + 1} tentatives`,
        );
      }
      const retryAfter = res.headers.get("Retry-After");
      const waitMs = retryAfter
        ? Math.min(parseFloat(retryAfter) * 1000, 30_000)
        : Math.min(1_000 * 2 ** attempt, 30_000);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    if (!res!.ok) {
      throw new Error(
        `[ressources/notion] Notion a retourné ${res!.status} sur /blocks/${blockId}/children`,
      );
    }

    const data = await res!.json();
    all.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return all;
}

const MAX_DEPTH = 6;
const CONCURRENCY = 3;

// Descend récursivement dans les blocs ayant has_children, jusqu'à MAX_DEPTH.
// Limite la concurrence à CONCURRENCY appels /children simultanés pour ne pas
// dépasser le rate-limit Notion (~3 req/s par intégration).
async function fetchAllBlocksRecursive(blockId: string, depth: number): Promise<any[]> {
  const blocks = await fetchBlockChildren(blockId);
  if (depth >= MAX_DEPTH) return blocks;

  const withChildren = blocks.filter((b: any) => b.has_children);
  if (withChildren.length === 0) return blocks;

  // Pool de concurrence borné.
  const childrenMap = new Map<string, any[]>();
  for (let i = 0; i < withChildren.length; i += CONCURRENCY) {
    const batch = withChildren.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((b: any) => fetchAllBlocksRecursive(b.id, depth + 1)),
    );
    batch.forEach((b: any, j: number) => childrenMap.set(b.id, results[j]));
  }

  return blocks.map((b: any) =>
    b.has_children ? { ...b, _children: childrenMap.get(b.id) ?? [] } : b,
  );
}

// Conservé comme point d'entrée public (appelé par fetchResourceBySlug + sync).
async function fetchAllBlocks(blockId: string): Promise<any[]> {
  return fetchAllBlocksRecursive(blockId, 0);
}
