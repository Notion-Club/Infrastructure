// ───────────────────────────────────────────────────────────────────────
// ROUTEUR NOTION — point d'entrée UNIQUE de récupération + normalisation du
// body d'une page Notion (server-only).
//
// Remplace les deux pipelines divergents :
//   • shared/lib/notion/blocks.ts        (Formation + Coaching)  — standard
//   • modules/ressources/lib/notion.ts   (Ressources, lossy)     — à retirer
//
// Principe : pour CHAQUE type de bloc de la cartographie API Notion, une entrée
// dans BLOCK_ROUTER décrit comment l'extraire en un `NotionBlock` normalisé et
// s'il porte des enfants. Tout type inconnu devient `unsupported` (jamais de
// drop silencieux : il reste dans l'arbre avec son `notionType`, le renderer
// l'ignore proprement sans casser la page).
//
// Le rich text est TOUJOURS préservé avec ses annotations (gras, italique,
// lien, couleur, code inline) — c'est ce qui manquait côté Ressources.
//
// ⚠️ Server-only : ne jamais importer depuis un Client Component. Le token
//    NOTION_API_TOKEN ne doit jamais atteindre le navigateur.
//
// Notion-Version actuelle du projet : 2022-06-28 (cf. client.ts). À cette
// version `heading_4`, `audio`, `tab` et `meeting_notes` n'existent pas encore
// (les meeting notes remontent sous `transcription`). Les handlers sont quand
// même enregistrés : inoffensifs tant que l'API ne les émet pas, et prêts pour
// un bump de version. Voir NOTE_VERSION en bas de fichier.
// ───────────────────────────────────────────────────────────────────────

import { notionFetch, normalizeNotionId } from "./client";

// ─── Types normalisés ──────────────────────────────────────────────────

export type RichSpan = {
  text: string;
  href: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  color: string;
  // Pour les rich text de type `equation` inline (KaTeX). Quand présent, le
  // renderer peut afficher l'expression mathématique plutôt que `text`.
  equation?: string;
};

// Forme « large » volontairement permissive (et non une union discriminée
// stricte) pour rester drop-in avec le renderer existant, qui `switch` sur
// `block.type`. Chaque champ optionnel n'est renseigné que pour les types
// concernés.
export type NotionBlock = {
  id: string;
  type: NotionBlockType | "unsupported";
  // Type Notion brut, renseigné uniquement quand type === "unsupported".
  notionType?: string;

  // Texte (paragraph, headings, list items, to_do, toggle, quote, callout, code)
  rich?: RichSpan[];

  // Médias / liens (image, video, audio, file, pdf, bookmark, embed, link_preview)
  url?: string | null;
  caption?: RichSpan[];
  name?: string | null; // file / pdf / audio : nom affiché

  // callout
  icon?: string | null; // emoji natif
  iconUrl?: string | null; // custom emoji / icône image / fichier
  color?: string | null; // callout, et headings/paragraphes colorés

  // to_do
  checked?: boolean;

  // code
  language?: string;

  // equation (bloc)
  expression?: string;

  // headings
  isToggleable?: boolean;

  // column
  widthRatio?: number | null;

  // table
  tableWidth?: number;
  hasColumnHeader?: boolean;
  hasRowHeader?: boolean;

  // table_row
  cells?: RichSpan[][];

  // child_page / child_database
  title?: string;

  // Enfants imbriqués (toggle, callout, quote, colonnes, listes, table…)
  children?: NotionBlock[];
};

export type NotionBlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "heading_4"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "to_do"
  | "toggle"
  | "quote"
  | "callout"
  | "code"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "pdf"
  | "bookmark"
  | "embed"
  | "link_preview"
  | "equation"
  | "divider"
  | "table_of_contents"
  | "breadcrumb"
  | "column_list"
  | "column"
  | "table"
  | "table_row"
  | "child_page"
  | "child_database";

// ─── Types bruts (sous-ensemble de l'API) ───────────────────────────────

type RawAnnotations = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: string;
};

type RawRichText = {
  type?: string;
  plain_text: string;
  href: string | null;
  annotations?: RawAnnotations;
  equation?: { expression?: string };
};

type RawBlock = {
  id: string;
  type: string;
  has_children: boolean;
  // Arbre pré-fetché éventuel (compat sync Ressources) : enfants déjà résolus.
  _children?: RawBlock[];
  [key: string]: unknown;
};

type ChildrenResponse = {
  results: RawBlock[];
  has_more: boolean;
  next_cursor: string | null;
};

// ─── Helpers d'extraction ───────────────────────────────────────────────

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
    ...(t.type === "equation" && t.equation?.expression
      ? { equation: t.equation.expression }
      : {}),
  }));
}

// URL d'un file object (external | file Notion-hosted | file_upload résolu).
function fileUrl(node: unknown): string | null {
  const n = node as
    | {
        type?: string;
        external?: { url: string };
        file?: { url: string };
      }
    | undefined;
  return n?.external?.url ?? n?.file?.url ?? null;
}

// Icône d'un callout : emoji natif, custom emoji (image), ou fichier/icône.
function parseIcon(icon: unknown): { emoji: string | null; url: string | null } {
  const i = icon as
    | {
        type?: string;
        emoji?: string;
        custom_emoji?: { url?: string };
        external?: { url?: string };
        file?: { url?: string };
      }
    | undefined;
  if (!i) return { emoji: null, url: null };
  if (i.type === "emoji" && i.emoji) return { emoji: i.emoji, url: null };
  const url =
    i.custom_emoji?.url ?? i.external?.url ?? i.file?.url ?? null;
  return { emoji: null, url };
}

function plainTitle(payload: Record<string, unknown> | undefined): string {
  return (payload?.title as string) ?? "";
}

// ─── Registre des handlers ──────────────────────────────────────────────
//
// supportsChildren : si true ET raw.has_children, le routeur descend en
// récursion et peuple `block.children`. Centralisé ici — aucun handler ne gère
// sa propre récursion.

type Handler = {
  supportsChildren: boolean;
  normalize: (
    raw: RawBlock,
    payload: Record<string, unknown> | undefined,
  ) => Partial<NotionBlock>;
};

const richOnly = (raw: RawBlock, p: Record<string, unknown> | undefined) => ({
  rich: parseRich(p?.rich_text as RawRichText[]),
  color: (p?.color as string) ?? "default",
});

const BLOCK_ROUTER: Record<NotionBlockType, Handler> = {
  // — Texte —
  paragraph: { supportsChildren: true, normalize: richOnly },
  heading_1: {
    supportsChildren: true, // si is_toggleable
    normalize: (r, p) => ({
      ...richOnly(r, p),
      isToggleable: (p?.is_toggleable as boolean) ?? false,
    }),
  },
  heading_2: {
    supportsChildren: true,
    normalize: (r, p) => ({
      ...richOnly(r, p),
      isToggleable: (p?.is_toggleable as boolean) ?? false,
    }),
  },
  heading_3: {
    supportsChildren: true,
    normalize: (r, p) => ({
      ...richOnly(r, p),
      isToggleable: (p?.is_toggleable as boolean) ?? false,
    }),
  },
  heading_4: {
    supportsChildren: true,
    normalize: (r, p) => ({
      ...richOnly(r, p),
      isToggleable: (p?.is_toggleable as boolean) ?? false,
    }),
  },
  bulleted_list_item: { supportsChildren: true, normalize: richOnly },
  numbered_list_item: { supportsChildren: true, normalize: richOnly },
  toggle: { supportsChildren: true, normalize: richOnly },
  quote: { supportsChildren: true, normalize: richOnly },
  to_do: {
    supportsChildren: true,
    normalize: (r, p) => ({
      ...richOnly(r, p),
      checked: (p?.checked as boolean) ?? false,
    }),
  },
  callout: {
    supportsChildren: true,
    normalize: (r, p) => {
      const { emoji, url } = parseIcon(p?.icon);
      return {
        rich: parseRich(p?.rich_text as RawRichText[]),
        color: (p?.color as string) ?? "default",
        icon: emoji,
        iconUrl: url,
      };
    },
  },
  code: {
    supportsChildren: false,
    normalize: (r, p) => ({
      rich: parseRich(p?.rich_text as RawRichText[]),
      caption: parseRich(p?.caption as RawRichText[]),
      language: (p?.language as string) ?? "plain text",
    }),
  },
  equation: {
    supportsChildren: false,
    normalize: (r, p) => ({ expression: (p?.expression as string) ?? "" }),
  },

  // — Médias (file object) —
  image: {
    supportsChildren: false,
    normalize: (r, p) => ({
      url: fileUrl(p),
      caption: parseRich(p?.caption as RawRichText[]),
    }),
  },
  video: {
    supportsChildren: false,
    normalize: (r, p) => ({
      url: fileUrl(p),
      caption: parseRich(p?.caption as RawRichText[]),
    }),
  },
  audio: {
    supportsChildren: false,
    normalize: (r, p) => ({
      url: fileUrl(p),
      caption: parseRich(p?.caption as RawRichText[]),
      name: (p?.name as string) ?? null,
    }),
  },
  file: {
    supportsChildren: false,
    normalize: (r, p) => ({
      url: fileUrl(p),
      caption: parseRich(p?.caption as RawRichText[]),
      name: (p?.name as string) ?? null,
    }),
  },
  pdf: {
    supportsChildren: false,
    normalize: (r, p) => ({
      url: fileUrl(p),
      caption: parseRich(p?.caption as RawRichText[]),
      name: (p?.name as string) ?? null,
    }),
  },

  // — Liens / embeds (url) —
  bookmark: {
    supportsChildren: false,
    normalize: (r, p) => ({
      url: (p?.url as string) ?? null,
      caption: parseRich(p?.caption as RawRichText[]),
    }),
  },
  embed: {
    supportsChildren: false,
    normalize: (r, p) => ({
      url: (p?.url as string) ?? null,
      caption: parseRich(p?.caption as RawRichText[]),
    }),
  },
  link_preview: {
    // ⚠️ Lecture seule côté API : ne jamais tenter de créer/append ce type.
    supportsChildren: false,
    normalize: (r, p) => ({ url: (p?.url as string) ?? null }),
  },

  // — Structure / mise en page —
  divider: { supportsChildren: false, normalize: () => ({}) },
  table_of_contents: {
    supportsChildren: false,
    normalize: (r, p) => ({ color: (p?.color as string) ?? "default" }),
  },
  breadcrumb: { supportsChildren: false, normalize: () => ({}) },
  column_list: { supportsChildren: true, normalize: () => ({}) },
  column: {
    supportsChildren: true,
    normalize: (r, p) => ({ widthRatio: (p?.width_ratio as number) ?? null }),
  },
  table: {
    supportsChildren: true, // enfants = table_row
    normalize: (r, p) => ({
      tableWidth: (p?.table_width as number) ?? 0,
      hasColumnHeader: (p?.has_column_header as boolean) ?? false,
      hasRowHeader: (p?.has_row_header as boolean) ?? false,
    }),
  },
  table_row: {
    supportsChildren: false,
    normalize: (r, p) => ({
      cells: ((p?.cells as RawRichText[][]) ?? []).map((cell) =>
        parseRich(cell),
      ),
    }),
  },

  // — Références (pas de contenu inline : on garde le titre comme repère) —
  child_page: {
    supportsChildren: false,
    normalize: (r, p) => ({ title: plainTitle(p) }),
  },
  child_database: {
    supportsChildren: false,
    normalize: (r, p) => ({ title: plainTitle(p) }),
  },
};

// ─── Cas structurels (résolus dans le driver, hors registre 1:1) ─────────
//
// Trois types ne se mappent pas en un bloc affichable : ils restructurent
// l'arbre. On les traite avant le registre.
//
//  • synced_block  : référence vers une source — on remonte ses enfants à plat.
//  • transcription / meeting_notes : conteneur Notion AI à 3 enfants
//      [0] Summary [1] Notes [2] Transcript. On ne remonte QUE le Transcript
//      (Summary/Notes sont déjà rendus ailleurs côté coaching). Aucun
//      discriminator dans le payload des enfants — on se fie à l'ordre fixe.
//  • paragraph vide + has_children : wrapper de groupement Notion AI — on
//      promeut ses enfants à plat (évite un <p></p> vide qui crée du gap).

const STRUCTURAL = new Set([
  "synced_block",
  "transcription",
  "meeting_notes",
]);

// ─── Fetch paginé des enfants ───────────────────────────────────────────

async function listChildren(blockId: string): Promise<RawBlock[]> {
  const id = normalizeNotionId(blockId);
  const out: RawBlock[] = [];
  let cursor: string | null = null;
  do {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("start_cursor", cursor);
    const data = await notionFetch<ChildrenResponse>(
      `/blocks/${id}/children?${qs.toString()}`,
      { method: "GET" },
    );
    out.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return out;
}

// Récupère les enfants d'un bloc : depuis l'arbre pré-fetché (_children) si
// présent, sinon via l'API. Permet à un appelant qui a déjà descendu l'arbre
// (ex. sync Ressources) de réutiliser le routeur sans refetch.
async function getChildren(raw: RawBlock): Promise<RawBlock[]> {
  if (Array.isArray(raw._children)) return raw._children;
  if (!raw.has_children) return [];
  return listChildren(raw.id);
}

// Profondeur max anti-boucle (synced blocks circulaires, imbrications).
const MAX_DEPTH = 6;

// Plafond d'appels /children simultanés. Sans borne, une page lourde émet une
// rafale parallèle qui dépasse le rate limit Notion (~3 req/s) → 429.
const MAX_CHILDREN_CONCURRENCY = 3;

// ─── Normalisation d'un bloc ────────────────────────────────────────────

const FRAGMENT = "__fragment__" as const;

type RoutedNode = NotionBlock | { type: typeof FRAGMENT; children: NotionBlock[] };

async function routeBlock(raw: RawBlock, depth: number): Promise<RoutedNode | null> {
  const t = raw.type;

  // — Cas structurels —
  if (STRUCTURAL.has(t)) {
    if (depth >= MAX_DEPTH) return null;

    if (t === "synced_block") {
      const payload = raw[t] as { synced_from?: { block_id?: string } | null };
      const sourceId = payload?.synced_from?.block_id ?? raw.id;
      const kids =
        Array.isArray(raw._children) && !payload?.synced_from
          ? raw._children
          : await listChildren(sourceId);
      return { type: FRAGMENT, children: await normalizeMany(kids, depth + 1) };
    }

    // transcription | meeting_notes : on isole le Transcript (3e enfant).
    const kids = await getChildren(raw);
    const transcriptWrapper = kids[2];
    if (!transcriptWrapper) return { type: FRAGMENT, children: [] };
    const wrapperKids = await getChildren(transcriptWrapper);
    return {
      type: FRAGMENT,
      children: await normalizeMany(wrapperKids, depth + 1),
    };
  }

  // — Paragraphe-wrapper vide → fragment —
  if (t === "paragraph" && raw.has_children) {
    const payload = raw[t] as Record<string, unknown> | undefined;
    const rich = parseRich(payload?.rich_text as RawRichText[]);
    const isEmpty = rich.length === 0 || rich.every((s) => s.text.trim() === "");
    if (isEmpty && depth < MAX_DEPTH) {
      const kids = await getChildren(raw);
      return { type: FRAGMENT, children: await normalizeMany(kids, depth + 1) };
    }
  }

  // — Registre —
  const handler = BLOCK_ROUTER[t as NotionBlockType];
  if (!handler) {
    // Type non géré : conservé explicitement (pas de drop silencieux).
    return { id: raw.id, type: "unsupported", notionType: t };
  }

  const payload = raw[t] as Record<string, unknown> | undefined;
  const block: NotionBlock = {
    id: raw.id,
    type: t as NotionBlockType,
    ...handler.normalize(raw, payload),
  };

  if (handler.supportsChildren && raw.has_children && depth < MAX_DEPTH) {
    const kids = await getChildren(raw);
    block.children = await normalizeMany(kids, depth + 1);
  }

  return block;
}

// ─── Concurrence bornée + aplatissement des fragments ────────────────────

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
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function normalizeMany(
  raws: RawBlock[],
  depth: number,
): Promise<NotionBlock[]> {
  const routed = await mapWithConcurrency(
    raws,
    MAX_CHILDREN_CONCURRENCY,
    (r) => routeBlock(r, depth),
  );
  const flat: NotionBlock[] = [];
  for (const node of routed) {
    if (!node) continue;
    if (node.type === FRAGMENT) flat.push(...node.children);
    else flat.push(node);
  }
  return flat;
}

// ─── Points d'entrée publics ────────────────────────────────────────────

// Récupère + normalise le body complet d'une page Notion. Drop-in pour
// l'ancien `fetchPageBlocks` de blocks.ts (même signature, même nom).
export async function fetchPageBlocks(pageId: string): Promise<NotionBlock[]> {
  const top = await listChildren(pageId);
  return normalizeMany(top, 0);
}

// Normalise un arbre brut DÉJÀ fetché (avec `_children` peuplés). Pour les
// appelants qui ont leur propre stratégie de fetch (ex. sync Ressources) et
// veulent uniquement la couche de normalisation, sans réseau supplémentaire.
export async function routePrefetchedTree(
  rawTree: RawBlock[],
): Promise<NotionBlock[]> {
  return normalizeMany(rawTree, 0);
}

// ───────────────────────────────────────────────────────────────────────
// NOTE_VERSION — types débloqués par un bump de Notion-Version :
//   • 2026-03-11 : heading_4, audio, tab, et meeting_notes (les pages d'appels
//     coaching remonteront sous `meeting_notes` au lieu de `transcription` —
//     déjà géré ci-dessus, les deux noms sont traités à l'identique).
//   Tant que client.ts reste en 2022-06-28, ces types n'apparaissent pas dans
//   les réponses : leurs handlers sont inertes, pas de risque de régression.
// ───────────────────────────────────────────────────────────────────────
