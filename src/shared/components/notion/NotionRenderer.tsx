"use client";

// ───────────────────────────────────────────────────────────────────────
// RENDERER NOTION UNIFIÉ — rendu unique pour TOUTE l'infrastructure.
//
// Consomme l'arbre `NotionBlock` produit par le routeur (shared/lib/notion/
// router.ts) et le rend selon le design system NotionClub. Remplace les deux
// rendus divergents :
//   • shared/components/notion/NotionBlocks.tsx     (Formation + Coaching)
//   • modules/ressources/.../ResourceContentBody.renderBlock (Ressources, lossy)
//
// Drop-in : l'export `NotionBlocks` est conservé en alias — les imports
// existants (`import { NotionBlocks }`) continuent de marcher sans changement.
// Nouveau nom canonique : `NotionRenderer`.
//
// Couvre TOUS les types de la cartographie : texte (+ annotations inline
// complètes : gras/italique/lien/couleur/code/équation), médias (image, video,
// audio, file, pdf), liens (bookmark, embed, link_preview), structure (toggle,
// callout, quote, colonnes, table, divider, table_of_contents), références
// (child_page, child_database). Les types inconnus (`unsupported`) sont ignorés
// proprement sans casser la page.
//
// Variations par espace : prop `density` ('comfortable' pour les pages de
// lecture — leçon, ressource ; 'compact' pour les contextes denses — modale
// transcription). PAS de parser ni de renderer dupliqué : c'est exactement la
// duplication qui a causé la divergence d'origine.
// ───────────────────────────────────────────────────────────────────────

import { createContext, useContext, useMemo, useState } from "react";
import {
  ChevronRight,
  Download,
  FileText,
  Database,
  ExternalLink,
} from "lucide-react";
import { clsx } from "clsx";

import type { NotionBlock, RichSpan } from "@/shared/lib/notion/router";
import { toEmbedSrc } from "@/shared/lib/notion/video";

// ─── Couleurs Notion — palette design system ────────────────────────────

const NOTION_TEXT_COLORS: Record<string, string> = {
  gray: "#6b7280",
  brown: "#92766a",
  orange: "#d9730d",
  yellow: "#cb912f",
  green: "#448361",
  blue: "#337ea9",
  purple: "#9065b0",
  pink: "#c14c8a",
  red: "#e0625a",
};

const NOTION_BG_COLORS: Record<string, string> = {
  gray_background: "#f1f1ef",
  brown_background: "#f4eeee",
  orange_background: "#fbecdd",
  yellow_background: "#fbf3db",
  green_background: "#edf3ec",
  blue_background: "#e7f3f8",
  purple_background: "#f6f3f9",
  pink_background: "#faf1f5",
  red_background: "#fdebec",
  default: "#f7f6f3",
};

// ─── Densité typographique ──────────────────────────────────────────────

export type NotionDensity = "comfortable" | "compact";

type Scale = {
  body: number;
  bodyLh: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
};

const SCALES: Record<NotionDensity, Scale> = {
  comfortable: { body: 15, bodyLh: 1.7, h1: 24, h2: 20, h3: 17, h4: 15 },
  compact: { body: 14, bodyLh: 1.65, h1: 20, h2: 17, h3: 15, h4: 14 },
};

// ─── Contexte de rendu (densité + scale + table des matières) ────────────

type TocEntry = { id: string; level: number; text: string };

type RenderCtx = {
  scale: Scale;
  density: NotionDensity;
  toc: TocEntry[];
};

const RenderContext = createContext<RenderCtx>({
  scale: SCALES.comfortable,
  density: "comfortable",
  toc: [],
});

const useRender = () => useContext(RenderContext);

// ─── Rich text inline (annotations complètes) ────────────────────────────

function Span({ s }: { s: RichSpan }) {
  // Emoji custom inline : image si résolue, sinon masqué (jamais le `:name:`).
  if (s.isEmoji) {
    if (!s.emojiUrl) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={s.emojiUrl}
        alt={s.text || ""}
        style={{
          display: "inline-block",
          width: "1.2em",
          height: "1.2em",
          objectFit: "contain",
          verticalAlign: "-0.22em",
          margin: "0 1px",
        }}
      />
    );
  }

  // Équation inline (KaTeX absent du projet) : rendu lisible en mono italique.
  if (s.equation) {
    return (
      <span
        style={{
          fontFamily: "var(--font-geist-mono, monospace)",
          fontStyle: "italic",
          background: "rgba(135,131,120,0.10)",
          padding: "1px 5px",
          borderRadius: 4,
        }}
      >
        {s.equation}
      </span>
    );
  }

  let node: React.ReactNode = s.text;
  if (s.code) {
    node = (
      <code
        style={{
          background: "rgba(135,131,120,0.15)",
          color: "#eb5757",
          padding: "2px 5px",
          borderRadius: 4,
          fontSize: "0.9em",
          fontFamily: "var(--font-geist-mono, monospace)",
        }}
      >
        {s.text}
      </code>
    );
  }

  const style: React.CSSProperties = {};
  if (s.bold) style.fontWeight = 600;
  if (s.italic) style.fontStyle = "italic";
  if (s.underline) style.textDecoration = "underline";
  if (s.strikethrough) {
    style.textDecoration = style.textDecoration
      ? `${style.textDecoration} line-through`
      : "line-through";
  }
  if (s.color && s.color !== "default" && NOTION_TEXT_COLORS[s.color]) {
    style.color = NOTION_TEXT_COLORS[s.color];
  }

  if (s.href) {
    return (
      <a
        href={s.href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          ...style,
          color: "var(--color-brand)",
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        {node}
      </a>
    );
  }
  return <span style={style}>{node}</span>;
}

function RichText({ spans }: { spans?: RichSpan[] }) {
  if (!spans || spans.length === 0) return null;
  return (
    <>
      {spans.map((s, i) => (
        <Span key={i} s={s} />
      ))}
    </>
  );
}

const spansToText = (spans?: RichSpan[]): string =>
  (spans ?? []).map((s) => (s.isEmoji ? "" : (s.equation ?? s.text))).join("");

// ─── Médias ──────────────────────────────────────────────────────────────

function VideoBlock({ url }: { url: string | null }) {
  if (!url) return null;
  const src = toEmbedSrc(url);
  const isFile =
    /\.(mp4|webm|mov)(\?|$)/i.test(url) && !url.includes("tella.tv");
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: 16,
        overflow: "hidden",
        background: "#000",
        boxShadow: "var(--nc-shadow-2)",
        margin: "8px 0",
      }}
    >
      {isFile ? (
        <video src={url} controls style={{ width: "100%", height: "100%" }} />
      ) : (
        <iframe
          src={src}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      )}
    </div>
  );
}

// URL embarquable en player vidéo (Tella, fichier vidéo brut, ou URL /embed
// déjà prête). Sinon → carte de lien. Couvre les rediffusions Tella collées en
// `embed`/`bookmark` dans Notion (et plus seulement le type `video`), pour ne
// pas régresser le comportement historique des pages Ressources.
function isEmbedVideo(url: string): boolean {
  return (
    /tella\.(tv|video)/i.test(url) ||
    /\/embed(\?|#|$)/.test(url) ||
    /\.(mp4|webm|mov)(\?|$)/i.test(url)
  );
}

function AudioBlock({ block }: { block: NotionBlock }) {
  if (!block.url) return null;
  return (
    <figure style={{ margin: "12px 0" }}>
      <audio controls src={block.url} style={{ width: "100%" }} />
      {(block.name || (block.caption?.length ?? 0) > 0) && (
        <figcaption
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            marginTop: 6,
          }}
        >
          {block.caption && block.caption.length > 0 ? (
            <RichText spans={block.caption} />
          ) : (
            block.name
          )}
        </figcaption>
      )}
    </figure>
  );
}

// Carte de fichier (file / pdf) : nom + lien d'ouverture.
function FileCard({ block, kind }: { block: NotionBlock; kind: "file" | "pdf" }) {
  if (!block.url) return null;
  const label =
    block.name || (kind === "pdf" ? "Document PDF" : "Fichier");
  return (
    <a
      href={block.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: "1px solid var(--color-border-default)",
        borderRadius: 12,
        padding: "12px 16px",
        margin: "10px 0",
        background: "var(--color-surface-raised, white)",
        textDecoration: "none",
        color: "var(--color-text-primary)",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          borderRadius: 9,
          background: NOTION_BG_COLORS.default,
          color: "var(--color-brand)",
        }}
      >
        <FileText size={18} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
        {block.caption && block.caption.length > 0 && (
          <span
            style={{
              display: "block",
              fontSize: 12,
              color: "var(--color-text-muted)",
              marginTop: 2,
            }}
          >
            <RichText spans={block.caption} />
          </span>
        )}
      </span>
      <Download size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
    </a>
  );
}

// Lien collé (bookmark / embed / link_preview) → bouton CTA cliquable.
//
// Note : les blocs Bouton NATIFS de Notion ne sont PAS exposés par l'API
// (ils reviennent en `unsupported`, sans URL ni action — cf. router) ; ils sont
// donc masqués. Pour obtenir un bouton dans l'app, coller un LIEN dans Notion :
// son URL est portée ici et recomposée en CTA ci-dessous.
function LinkCard({ block }: { block: NotionBlock }) {
  if (!block.url) return null;
  let host = block.url;
  try {
    host = new URL(block.url).hostname.replace(/^www\./, "");
  } catch {
    /* URL non parsable : on garde la chaîne brute */
  }
  const caption = spansToText(block.caption);
  const label = caption || host;
  return (
    <div style={{ margin: "12px 0" }}>
      <a
        href={block.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-85"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 20px",
          borderRadius: 9999,
          background: "var(--nc-btn-dark-bg, #1f1c1c)",
          color: "var(--nc-btn-dark-text, #ffffff)",
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          maxWidth: "100%",
          transition: "opacity 150ms ease",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <ExternalLink size={15} style={{ flexShrink: 0 }} />
      </a>
    </div>
  );
}

// ─── Toggle (bloc et heading repliable) ──────────────────────────────────

function Collapsible({
  summary,
  children,
  summaryStyle,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  summaryStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ margin: "4px 0" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
          width: "100%",
          ...summaryStyle,
        }}
      >
        <ChevronRight
          size={16}
          style={{
            marginTop: 4,
            flexShrink: 0,
            transition: "transform 150ms ease",
            transform: open ? "rotate(90deg)" : "none",
          }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>{summary}</span>
      </button>
      {open && <div style={{ paddingLeft: 22, marginTop: 4 }}>{children}</div>}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────

function TableBlock({ block }: { block: NotionBlock }) {
  const { scale } = useRender();
  const rows = (block.children ?? []).filter((b) => b.type === "table_row");
  if (rows.length === 0) return null;

  return (
    <div style={{ overflowX: "auto", margin: "14px 0" }}>
      <table
        data-fb-label="Tableau Notion · Corps Notion"
        style={{
          borderCollapse: "collapse",
          width: "100%",
          fontSize: scale.body - 1,
          border: "1px solid var(--color-border-default)",
          borderRadius: 8,
        }}
      >
        <tbody>
          {rows.map((row, ri) => {
            const isHeaderRow = ri === 0 && block.hasColumnHeader;
            return (
              <tr key={row.id}>
                {(row.cells ?? []).map((cell, ci) => {
                  const isHeaderCol = ci === 0 && block.hasRowHeader;
                  const Tag = isHeaderRow || isHeaderCol ? "th" : "td";
                  return (
                    <Tag
                      key={ci}
                      style={{
                        border: "1px solid var(--color-border-default)",
                        padding: "8px 12px",
                        textAlign: "left",
                        verticalAlign: "top",
                        lineHeight: 1.5,
                        color: "var(--color-text-secondary)",
                        fontWeight: isHeaderRow || isHeaderCol ? 600 : 400,
                        background:
                          isHeaderRow || isHeaderCol
                            ? NOTION_BG_COLORS.default
                            : "transparent",
                      }}
                    >
                      <RichText spans={cell} />
                    </Tag>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Table des matières (auto, à partir des headings de la page) ─────────

function TableOfContents() {
  const { toc, scale } = useRender();
  if (toc.length === 0) return null;
  return (
    <nav
      style={{
        margin: "14px 0",
        padding: "12px 16px",
        border: "1px solid var(--color-border-default)",
        borderRadius: 12,
        background: NOTION_BG_COLORS.default,
      }}
    >
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {toc.map((h) => (
          <li
            key={h.id}
            style={{ paddingLeft: (h.level - 1) * 14, margin: "2px 0" }}
          >
            <a
              href={`#${h.id}`}
              style={{
                color: "var(--color-text-secondary)",
                textDecoration: "none",
                fontSize: scale.body - 1,
                lineHeight: 1.6,
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Référence vers une sous-page / sous-base (pas de route interne — chip).
function ReferenceChip({ block }: { block: NotionBlock }) {
  const isDb = block.type === "child_database";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid var(--color-border-default)",
        borderRadius: 10,
        padding: "10px 14px",
        margin: "8px 0",
        background: "var(--color-surface-raised, white)",
        fontSize: 14,
        color: "var(--color-text-primary)",
      }}
    >
      {isDb ? (
        <Database size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
      ) : (
        <FileText size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
      )}
      <span style={{ fontWeight: 500 }}>{block.title || "Sans titre"}</span>
    </div>
  );
}

// ─── Bloc unique ─────────────────────────────────────────────────────────

function SingleBlock({ block }: { block: NotionBlock }) {
  const { scale } = useRender();
  const paragraphStyle: React.CSSProperties = {
    fontSize: scale.body,
    lineHeight: scale.bodyLh,
    color: "var(--color-text-secondary)",
    margin: "6px 0",
  };

  switch (block.type) {
    case "paragraph": {
      const hasText = (block.rich ?? []).some((s) => spansToText([s]).length > 0);
      const hasChildren = (block.children ?? []).length > 0;
      if (!hasText && !hasChildren) return null;
      // Les enfants d'un paragraphe (contenu indenté sous une ligne de texte)
      // sont rendus EN FRÈRES du <p>, jamais dedans : BlockList produit des
      // éléments bloc (<div>, <ul>, <blockquote>…) et un bloc dans un <p> est
      // du HTML invalide → le navigateur ferme le <p> → mismatch d'hydratation.
      return (
        <>
          {hasText && (
            <p data-fb-label="Paragraphe Notion · Corps Notion" style={paragraphStyle}>
              <RichText spans={block.rich} />
            </p>
          )}
          {hasChildren && (
            <div style={{ paddingLeft: 22 }}>
              <BlockList blocks={block.children!} />
            </div>
          )}
        </>
      );
    }

    case "heading_1":
    case "heading_2":
    case "heading_3":
    case "heading_4": {
      const sizes = {
        heading_1: { fontSize: scale.h1, weight: 700, margin: "24px 0 8px", letter: "-0.02em" },
        heading_2: { fontSize: scale.h2, weight: 600, margin: "20px 0 6px", letter: "-0.01em" },
        heading_3: { fontSize: scale.h3, weight: 600, margin: "16px 0 4px", letter: "0" },
        heading_4: { fontSize: scale.h4, weight: 600, margin: "14px 0 4px", letter: "0" },
      }[block.type];
      const Tag = (
        { heading_1: "h2", heading_2: "h3", heading_3: "h4", heading_4: "h5" } as const
      )[block.type];
      const headingNode = (
        <Tag
          id={block.id}
          data-fb-label="Titre Notion · Corps Notion"
          style={{
            fontSize: sizes.fontSize,
            fontWeight: sizes.weight,
            letterSpacing: sizes.letter,
            color: "var(--color-text-primary)",
            margin: sizes.margin,
            scrollMarginTop: 80,
          }}
        >
          <RichText spans={block.rich} />
        </Tag>
      );
      // Heading repliable (is_toggleable) avec enfants.
      if (block.isToggleable && (block.children?.length ?? 0) > 0) {
        return (
          <Collapsible
            summary={headingNode}
            summaryStyle={{ color: "var(--color-text-primary)" }}
          >
            <BlockList blocks={block.children!} />
          </Collapsible>
        );
      }
      return headingNode;
    }

    case "quote":
      return (
        <blockquote
          data-fb-label="Citation Notion · Corps Notion"
          style={{
            borderLeft: "3px solid var(--color-brand)",
            paddingLeft: 14,
            margin: "10px 0",
            color: "var(--color-text-secondary)",
            fontSize: scale.body,
            lineHeight: 1.6,
          }}
        >
          <RichText spans={block.rich} />
          {block.children && <BlockList blocks={block.children} />}
        </blockquote>
      );

    case "callout":
      return (
        <div
          data-fb-label="Callout Notion · Corps Notion"
          style={{
            display: "flex",
            gap: 10,
            background:
              NOTION_BG_COLORS[block.color ?? "default"] ?? NOTION_BG_COLORS.default,
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            padding: "14px 16px",
            margin: "12px 0",
          }}
        >
          {block.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.iconUrl}
              alt=""
              style={{ width: 20, height: 20, flexShrink: 0, objectFit: "contain" }}
            />
          ) : block.icon ? (
            <span style={{ fontSize: 18, lineHeight: 1.5, flexShrink: 0 }}>
              {block.icon}
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: scale.body,
                lineHeight: 1.6,
                color: "var(--color-text-primary)",
              }}
            >
              <RichText spans={block.rich} />
            </div>
            {block.children && <BlockList blocks={block.children} />}
          </div>
        </div>
      );

    case "code":
      return (
        <pre
          data-fb-label="Bloc code Notion · Corps Notion"
          style={{
            background: "#1f1c1c",
            color: "#f5f5f5",
            borderRadius: 12,
            padding: 16,
            overflow: "auto",
            fontSize: 13,
            lineHeight: 1.5,
            margin: "12px 0",
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          <code>{spansToText(block.rich)}</code>
        </pre>
      );

    case "equation":
      // KaTeX absent — expression brute centrée, lisible. Brancher katex ici
      // si un vrai rendu mathématique devient nécessaire.
      return block.expression ? (
        <div
          data-fb-label="Équation Notion · Corps Notion"
          style={{
            margin: "12px 0",
            padding: "12px 16px",
            textAlign: "center",
            fontFamily: "var(--font-geist-mono, monospace)",
            fontStyle: "italic",
            fontSize: scale.body,
            color: "var(--color-text-primary)",
            background: NOTION_BG_COLORS.default,
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
          {block.expression}
        </div>
      ) : null;

    case "image":
      return (
        <figure data-fb-label="Image Notion · Corps Notion" style={{ margin: "14px 0" }}>
          {block.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.url}
              alt={spansToText(block.caption) || ""}
              style={{ width: "100%", borderRadius: 12, display: "block" }}
            />
          )}
          {block.caption && block.caption.length > 0 && (
            <figcaption
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginTop: 6,
                textAlign: "center",
              }}
            >
              <RichText spans={block.caption} />
            </figcaption>
          )}
        </figure>
      );

    case "video":
      return <VideoBlock url={block.url ?? null} />;
    case "audio":
      return <AudioBlock block={block} />;
    case "file":
      return <FileCard block={block} kind="file" />;
    case "pdf":
      return <FileCard block={block} kind="pdf" />;

    case "bookmark":
    case "embed":
    case "link_preview":
      return block.url && isEmbedVideo(block.url) ? (
        <VideoBlock url={block.url} />
      ) : (
        <LinkCard block={block} />
      );

    case "toggle":
      return (
        <Collapsible
          summary={
            <span
              style={{
                fontSize: scale.body,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
              }}
            >
              <RichText spans={block.rich} />
            </span>
          }
          summaryStyle={{ color: "var(--color-text-secondary)" }}
        >
          {block.children && <BlockList blocks={block.children} />}
        </Collapsible>
      );

    case "to_do":
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "4px 0" }}>
          <input
            type="checkbox"
            checked={!!block.checked}
            readOnly
            style={{ marginTop: 5, accentColor: "var(--color-brand)" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                ...paragraphStyle,
                margin: 0,
                display: "block",
                textDecoration: block.checked ? "line-through" : "none",
                opacity: block.checked ? 0.65 : 1,
              }}
            >
              <RichText spans={block.rich} />
            </span>
            {block.children && <BlockList blocks={block.children} />}
          </div>
        </div>
      );

    case "divider":
      return (
        <hr
          style={{
            border: "none",
            borderTop: "1px solid var(--color-border-default)",
            margin: "20px 0",
          }}
        />
      );

    case "column_list":
      return (
        <div className="flex flex-col md:flex-row gap-4" style={{ margin: "12px 0" }}>
          {(block.children ?? []).map((col) => (
            <div
              key={col.id}
              style={{
                flex: col.widthRatio ? `${col.widthRatio} 1 0%` : 1,
                minWidth: 0,
              }}
            >
              <BlockList blocks={col.children ?? []} />
            </div>
          ))}
        </div>
      );

    case "table":
      return <TableBlock block={block} />;

    case "table_of_contents":
      return <TableOfContents />;

    case "child_page":
    case "child_database":
      return <ReferenceChip block={block} />;

    // breadcrumb : purement navigationnel, aucun contenu — skip propre.
    // unsupported : type non géré par l'API/le routeur — ignoré sans casse.
    default:
      return null;
  }
}

// ─── Regroupement des listes + délégation ────────────────────────────────

function BlockList({ blocks }: { blocks: NotionBlock[] }) {
  const { scale } = useRender();
  const out: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const b = blocks[i];

    if (b.type === "bulleted_list_item" || b.type === "numbered_list_item") {
      const ordered = b.type === "numbered_list_item";
      const group: NotionBlock[] = [];
      while (i < blocks.length && blocks[i].type === b.type) {
        group.push(blocks[i]);
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      out.push(
        <ListTag
          key={`list-${group[0].id}`}
          data-fb-label="Liste Notion · Corps Notion"
          style={{
            margin: "8px 0",
            paddingLeft: 22,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {group.map((item) => (
            <li
              key={item.id}
              style={{
                fontSize: scale.body,
                lineHeight: scale.bodyLh,
                color: "var(--color-text-secondary)",
                margin: 0,
              }}
            >
              <RichText spans={item.rich} />
              {item.children && item.children.length > 0 && (
                <BlockList blocks={item.children} />
              )}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    out.push(<SingleBlock key={b.id} block={b} />);
    i++;
  }

  return <>{out}</>;
}

// ─── Collecte de la table des matières ───────────────────────────────────

const HEADING_LEVEL: Record<string, number> = {
  heading_1: 1,
  heading_2: 2,
  heading_3: 3,
  heading_4: 4,
};

function collectToc(blocks: NotionBlock[], acc: TocEntry[] = []): TocEntry[] {
  for (const b of blocks) {
    const level = HEADING_LEVEL[b.type];
    if (level) {
      const text = spansToText(b.rich);
      if (text) acc.push({ id: b.id, level, text });
    }
    if (b.children && b.children.length > 0) collectToc(b.children, acc);
  }
  return acc;
}

// ─── Point d'entrée ──────────────────────────────────────────────────────

export type NotionRendererProps = {
  blocks: NotionBlock[];
  /** Densité typographique. 'comfortable' (défaut) pour les pages de lecture,
   *  'compact' pour les contextes denses (modale transcription). */
  density?: NotionDensity;
  /** Label feedback-widget du conteneur racine. `null` pour ne pas en poser
   *  (utile quand l'appelant fournit déjà son propre wrapper labellisé). */
  label?: string | null;
  /** Message affiché quand il n'y a aucun bloc. */
  emptyLabel?: string;
  className?: string;
};

export function NotionRenderer({
  blocks,
  density = "comfortable",
  label = "Corps Notion",
  emptyLabel = "Ce contenu n'a pas encore de corps.",
  className,
}: NotionRendererProps) {
  const ctx = useMemo<RenderCtx>(
    () => ({
      scale: SCALES[density],
      density,
      toc: collectToc(blocks),
    }),
    [blocks, density],
  );

  if (!blocks || blocks.length === 0) {
    return (
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
        }}
      >
        {emptyLabel}
      </p>
    );
  }

  return (
    <RenderContext.Provider value={ctx}>
      <div
        className={clsx(className)}
        {...(label ? { "data-fb-label": label } : {})}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <BlockList blocks={blocks} />
      </div>
    </RenderContext.Provider>
  );
}

// Alias drop-in : conserve la compat des imports existants
// (`import { NotionBlocks } from "@/shared/components/notion/..."`).
export const NotionBlocks = NotionRenderer;
