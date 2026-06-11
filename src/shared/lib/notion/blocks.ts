// Récupération + normalisation du body d'une page Notion (server-only).
//
// L'API renvoie des blocs bruts paginés ; on les récupère récursivement
// (has_children) et on résout les synced_block (références vers une source).
// Le résultat est un arbre de NotionBlock typés, prêt à rendre côté client.
//
// Lazy par nature : appelé uniquement à l'ouverture d'un cours.

import { notionFetch, normalizeNotionId } from "./client";

export type RichSpan = {
  text: string;
  href: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  color: string;
};

export type NotionBlock = {
  id: string;
  type: string;
  rich?: RichSpan[];
  // image / video / embed / bookmark / file
  url?: string | null;
  caption?: RichSpan[];
  // callout
  icon?: string | null;
  color?: string | null;
  // to_do
  checked?: boolean;
  // code
  language?: string;
  // listes, toggle, callout, quote, colonnes…
  children?: NotionBlock[];
};

type RawAnnotations = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: string;
};

type RawRichText = {
  plain_text: string;
  href: string | null;
  annotations?: RawAnnotations;
};

type RawBlock = {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
};

type ChildrenResponse = {
  results: RawBlock[];
  has_more: boolean;
  next_cursor: string | null;
};

function parseRich(rt?: RawRichText[]): RichSpan[] {
  return (rt ?? []).map((t) => ({
    text: t.plain_text,
    href: t.href,
    bold: t.annotations?.bold ?? false,
    italic: t.annotations?.italic ?? false,
    underline: t.annotations?.underline ?? false,
    strikethrough: t.annotations?.strikethrough ?? false,
    code: t.annotations?.code ?? false,
    color: t.annotations?.color ?? "default",
  }));
}

function fileUrl(node: unknown): string | null {
  const n = node as
    | { type?: string; external?: { url: string }; file?: { url: string } }
    | undefined;
  return n?.external?.url ?? n?.file?.url ?? null;
}

async function listChildren(blockId: string): Promise<RawBlock[]> {
  const id = normalizeNotionId(blockId);
  const out: RawBlock[] = [];
  let cursor: string | null = null;
  do {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("start_cursor", cursor);
    const data: ChildrenResponse = await notionFetch<ChildrenResponse>(
      `/blocks/${id}/children?${qs.toString()}`,
      { method: "GET" },
    );
    out.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return out;
}

// Profondeur max de récursion pour éviter les boucles (synced blocks
// circulaires, imbrications pathologiques).
const MAX_DEPTH = 6;

async function normalizeBlock(
  raw: RawBlock,
  depth: number,
): Promise<NotionBlock | null> {
  const t = raw.type;
  const payload = raw[t] as Record<string, unknown> | undefined;

  // Synced block : on résout vers la source si c'est une référence, puis on
  // remonte directement ses enfants (transparent pour le rendu).
  if (t === "synced_block") {
    const syncedFrom = payload?.synced_from as { block_id?: string } | null;
    const sourceId = syncedFrom?.block_id ?? raw.id;
    if (depth >= MAX_DEPTH) return null;
    const kids = await listChildren(sourceId);
    const children = await normalizeMany(kids, depth + 1);
    return { id: raw.id, type: "fragment", children };
  }

  // Bloc custom Notion AI "transcription" : conteneur Notion AI avec
  // exactement 3 enfants paragraphes-wrappers ordonnés :
  //    [0] Summary    (résumé structuré : Action Items + sections)
  //    [1] Notes      (notes manuelles — souvent vide)
  //    [2] Transcript (verbatim brut de l'appel)
  //
  // L'API Notion ne fournit AUCUN discriminator dans le payload des enfants :
  // les 3 sont des `paragraph` vides identiques. On se fie à l'ordre fixe.
  // On ne remonte QUE l'enfant Transcript (index 2) — le Summary et les
  // Notes sont déjà rendus ailleurs côté coaching (onglet Résumé + propriété
  // "Résumé IA"), pas besoin de les dupliquer.
  if (t === "transcription") {
    if (depth >= MAX_DEPTH) return null;
    const kids = raw.has_children ? await listChildren(raw.id) : [];
    const transcriptWrapper = kids[2]; // 3e enfant = Transcript
    if (!transcriptWrapper) {
      return { id: raw.id, type: "fragment", children: [] };
    }
    const wrapperKids = transcriptWrapper.has_children
      ? await listChildren(transcriptWrapper.id)
      : [];
    const children = await normalizeMany(wrapperKids, depth + 1);
    return { id: raw.id, type: "fragment", children };
  }

  // Paragraphe-wrapper : rich_text vide + has_children. C'est un pattern
  // utilisé par les blocs Notion AI (transcription) pour grouper du contenu
  // sans ajouter de bullet visible. On le promeut en fragment pour que ses
  // enfants soient rendus directement, sans <p></p> vide qui crée du gap.
  if (t === "paragraph" && raw.has_children) {
    const rich = parseRich(payload?.rich_text as RawRichText[]);
    const isEmpty = rich.length === 0 || rich.every((s) => s.text.trim() === "");
    if (isEmpty && depth < MAX_DEPTH) {
      const kids = await listChildren(raw.id);
      const children = await normalizeMany(kids, depth + 1);
      return { id: raw.id, type: "fragment", children };
    }
  }

  const block: NotionBlock = { id: raw.id, type: t };

  switch (t) {
    case "paragraph":
    case "heading_1":
    case "heading_2":
    case "heading_3":
    case "quote":
    case "toggle":
      block.rich = parseRich(payload?.rich_text as RawRichText[]);
      break;
    case "bulleted_list_item":
    case "numbered_list_item":
      block.rich = parseRich(payload?.rich_text as RawRichText[]);
      break;
    case "to_do":
      block.rich = parseRich(payload?.rich_text as RawRichText[]);
      block.checked = (payload?.checked as boolean) ?? false;
      break;
    case "callout":
      block.rich = parseRich(payload?.rich_text as RawRichText[]);
      block.color = (payload?.color as string) ?? "default";
      block.icon =
        ((payload?.icon as { emoji?: string })?.emoji ?? null) || null;
      break;
    case "code":
      block.rich = parseRich(payload?.rich_text as RawRichText[]);
      block.language = (payload?.language as string) ?? "plain text";
      break;
    case "image":
    case "video":
    case "file":
    case "pdf":
      block.url = fileUrl(payload);
      block.caption = parseRich(payload?.caption as RawRichText[]);
      break;
    case "bookmark":
    case "embed":
    case "link_preview":
      block.url = (payload?.url as string) ?? null;
      block.caption = parseRich(payload?.caption as RawRichText[]);
      break;
    case "divider":
    case "column_list":
    case "column":
    case "table":
    case "table_row":
      break;
    default:
      // Type non géré explicitement : on le marque, le renderer l'ignore
      // proprement (sans casser la page).
      block.type = "unsupported";
      (block as NotionBlock & { notionType?: string }).notionType = t;
      break;
  }

  // Récursion sur les enfants (toggle, callout, colonnes, listes imbriquées…)
  if (raw.has_children && depth < MAX_DEPTH && block.type !== "unsupported") {
    const kids = await listChildren(raw.id);
    block.children = await normalizeMany(kids, depth + 1);
  }

  return block;
}

// Plafond d'appels /children simultanés. La récursion de normalizeBlock
// déclenche un appel listChildren par bloc à enfants ; sans borne, une page
// lourde (transcription coaching, cours dense) émet une rafale parallèle qui
// dépasse le rate limit Notion (~3 req/s) → 429 → 500. Un pool borné lisse la
// charge tout en gardant un peu de parallélisme.
const MAX_CHILDREN_CONCURRENCY = 3;

// Mappe `items` via `fn` avec au plus `limit` exécutions concurrentes, en
// préservant l'ordre des résultats (results[i] ↔ items[i]).
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

async function normalizeMany(
  raws: RawBlock[],
  depth: number,
): Promise<NotionBlock[]> {
  const results = await mapWithConcurrency(
    raws,
    MAX_CHILDREN_CONCURRENCY,
    (r) => normalizeBlock(r, depth),
  );
  // Aplatit les fragments (synced blocks résolus) dans le flux parent.
  const flat: NotionBlock[] = [];
  for (const b of results) {
    if (!b) continue;
    if (b.type === "fragment") flat.push(...(b.children ?? []));
    else flat.push(b);
  }
  return flat;
}

// Point d'entrée : récupère le body normalisé d'une page Notion (cours).
export async function fetchPageBlocks(pageId: string): Promise<NotionBlock[]> {
  const top = await listChildren(pageId);
  return normalizeMany(top, 0);
}
