// Client Notion serveur générique — fetch natif, aligné sur le pattern déjà
// utilisé par /api/feedback et /api/tickets (Notion-Version 2022-06-28,
// Bearer NOTION_API_TOKEN).
//
// ⚠️  Server-only : ne jamais importer depuis un Client Component. Le token
//     ne doit jamais atteindre le navigateur.
//
// Prérequis : l'intégration derrière NOTION_API_TOKEN doit être connectée aux
// bases interrogées (Formations / Modules / Cours). Sinon Notion renvoie un
// 404 object_not_found — l'erreur est propagée telle quelle.

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Rate limit Notion : ~3 req/s. Sur 429, l'API renvoie un header Retry-After
// (en secondes). On respecte ce délai s'il est présent, sinon on retombe sur
// un backoff exponentiel. Plafond de tentatives volontairement bas : au-delà,
// mieux vaut propager l'erreur que de bloquer le rendu de la page trop
// longtemps.
const MAX_RETRIES_429 = 4;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calcule le délai d'attente avant la prochaine tentative après un 429.
// Priorité au header Retry-After (secondes) ; fallback backoff exponentiel.
function retryDelayMs(res: Response, attempt: number): number {
  const header = res.headers.get("Retry-After");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return BASE_BACKOFF_MS * 2 ** attempt;
}

export class NotionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly notionCode?: string,
  ) {
    super(message);
    this.name = "NotionError";
  }
}

function getToken(): string {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) {
    throw new NotionError("NOTION_API_TOKEN manquant côté serveur", 500);
  }
  return token;
}

// Normalise un ID Notion (avec ou sans tirets, ou une URL) au format canonique
// de l'API : UUID v4 minuscule avec tirets (8-4-4-4-12).
export function normalizeNotionId(input: string): string {
  const hex = input
    .trim()
    .replace(/^https?:\/\/[^/]+\//, "") // retire le domaine si URL
    .split(/[?#]/)[0] // retire query/hash
    .split("-")
    .pop()! // garde le dernier segment (slug-id)
    .replace(/[^0-9a-fA-F]/g, "")
    .toLowerCase();

  if (hex.length !== 32) {
    // Déjà au bon format, ou format inattendu : on retourne tel quel nettoyé.
    const compact = input.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
    if (compact.length !== 32) return input;
    return formatUuid(compact);
  }
  return formatUuid(hex);
}

function formatUuid(hex32: string): string {
  return [
    hex32.slice(0, 8),
    hex32.slice(8, 12),
    hex32.slice(12, 16),
    hex32.slice(16, 20),
    hex32.slice(20, 32),
  ].join("-");
}

async function notionFetch<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  const { body, ...rest } = init ?? {};
  const serializedBody =
    body !== undefined ? JSON.stringify(body) : undefined;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${NOTION_API}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
      body: serializedBody,
      cache: "no-store",
    });

    // 429 (rate limit) : on attend (Retry-After ou backoff) puis on rejoue,
    // jusqu'au plafond. Au dernier essai épuisé, on laisse tomber dans la
    // gestion d'erreur ci-dessous pour propager un NotionError propre.
    if (res.status === 429 && attempt < MAX_RETRIES_429) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      throw new NotionError(
        err.message ?? `Notion a retourné ${res.status}`,
        res.status,
        err.code,
      );
    }
    return (await res.json()) as T;
  }
}

// ─── Types bruts (sous-ensemble de l'API) ──────────────────────────────

export type NotionRichText = {
  plain_text: string;
  href: string | null;
  annotations?: Record<string, unknown>;
};

export type NotionPropertyValue = {
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  number?: number | null;
  checkbox?: boolean;
  url?: string | null;
  status?: { name: string } | null;
  select?: { name: string } | null;
  multi_select?: Array<{ name: string }>;
  relation?: Array<{ id: string }>;
  files?: Array<{
    name: string;
    external?: { url: string };
    file?: { url: string };
  }>;
};

export type NotionPage = {
  id: string;
  archived: boolean;
  in_trash?: boolean;
  // `parent` permet de vérifier qu'une page appartient bien à la DB attendue
  // (défense en profondeur côté routes sensibles, cf. /api/payments/invoice).
  parent?: {
    type?: string;
    database_id?: string;
    page_id?: string;
    workspace?: boolean;
  };
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionPropertyValue>;
};

type QueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

// ─── Helpers de lecture de propriétés ───────────────────────────────────

export function richTextToPlain(rt?: NotionRichText[]): string {
  return (rt ?? []).map((t) => t.plain_text).join("");
}

export function getTitle(page: NotionPage, prop: string): string {
  return richTextToPlain(page.properties[prop]?.title);
}

export function getRichText(page: NotionPage, prop: string): string {
  return richTextToPlain(page.properties[prop]?.rich_text);
}

export function getNumber(page: NotionPage, prop: string): number | null {
  return page.properties[prop]?.number ?? null;
}

export function getCheckbox(page: NotionPage, prop: string): boolean {
  return page.properties[prop]?.checkbox ?? false;
}

export function getSelect(page: NotionPage, prop: string): string | null {
  return page.properties[prop]?.select?.name ?? null;
}

export function getMultiSelect(page: NotionPage, prop: string): string[] {
  return (page.properties[prop]?.multi_select ?? []).map((o) => o.name);
}

export function getRelationIds(page: NotionPage, prop: string): string[] {
  return (page.properties[prop]?.relation ?? []).map((r) =>
    normalizeNotionId(r.id),
  );
}

export function getFirstFileUrl(page: NotionPage, prop: string): string | null {
  const f = page.properties[prop]?.files?.[0];
  return f?.external?.url ?? f?.file?.url ?? null;
}

// ─── Opérations haut niveau ─────────────────────────────────────────────

// Query une database entière en suivant la pagination (100/page).
export async function queryDatabaseAll(databaseId: string): Promise<NotionPage[]> {
  const id = normalizeNotionId(databaseId);
  const pages: NotionPage[] = [];
  let cursor: string | null = null;

  do {
    const data: QueryResponse = await notionFetch<QueryResponse>(
      `/databases/${id}/query`,
      {
        method: "POST",
        body: {
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        },
      },
    );
    pages.push(...data.results.filter((p) => !p.archived && !p.in_trash));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages;
}

export async function getPage(pageId: string): Promise<NotionPage> {
  return notionFetch<NotionPage>(`/pages/${normalizeNotionId(pageId)}`, {
    method: "GET",
  });
}

export { notionFetch };
