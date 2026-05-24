"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import type { NotionBlock, RichSpan } from "@/shared/lib/notion/blocks";

// Renderer fidèle d'un arbre de blocs Notion normalisés. Les listes
// consécutives sont regroupées en <ul>/<ol>. Les vidéos Tella sont
// embarquées en iframe 16:9. Les types inconnus sont ignorés proprement.

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

function Span({ s }: { s: RichSpan }) {
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
        style={{ ...style, color: "var(--color-brand)", textDecoration: "underline", textUnderlineOffset: 2 }}
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

function tellaEmbedUrl(url: string): string | null {
  // https://www.tella.tv/video/<id>/view → /embed
  const m = url.match(/tella\.tv\/video\/([^/?#]+)/);
  if (!m) return null;
  return `https://www.tella.tv/video/${m[1]}/embed`;
}

function VideoBlock({ url }: { url: string | null }) {
  if (!url) return null;
  const tella = tellaEmbedUrl(url);
  const src = tella ?? url;
  // Fichiers vidéo bruts (mp4…) : balise <video>. Sinon iframe (Tella, YT…).
  const isFile = /\.(mp4|webm|mov)(\?|$)/i.test(url) && !tella;
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

function Toggle({ block }: { block: NotionBlock }) {
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
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--color-text-secondary)",
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
        <span>
          <RichText spans={block.rich} />
        </span>
      </button>
      {open && block.children && (
        <div style={{ paddingLeft: 22, marginTop: 4 }}>
          <BlockList blocks={block.children} />
        </div>
      )}
    </div>
  );
}

const paragraphStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.7,
  color: "var(--color-text-secondary)",
  margin: "6px 0",
};

function SingleBlock({ block }: { block: NotionBlock }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p style={paragraphStyle}>
          <RichText spans={block.rich} />
        </p>
      );
    case "heading_1":
      return (
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-primary)", margin: "24px 0 8px" }}>
          <RichText spans={block.rich} />
        </h2>
      );
    case "heading_2":
      return (
        <h3 style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-text-primary)", margin: "20px 0 6px" }}>
          <RichText spans={block.rich} />
        </h3>
      );
    case "heading_3":
      return (
        <h4 style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text-primary)", margin: "16px 0 4px" }}>
          <RichText spans={block.rich} />
        </h4>
      );
    case "quote":
      return (
        <blockquote
          style={{
            borderLeft: "3px solid var(--color-brand)",
            paddingLeft: 14,
            margin: "10px 0",
            color: "var(--color-text-secondary)",
            fontSize: 15,
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
          style={{
            display: "flex",
            gap: 10,
            background: NOTION_BG_COLORS[block.color ?? "default"] ?? NOTION_BG_COLORS.default,
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            padding: "14px 16px",
            margin: "12px 0",
          }}
        >
          {block.icon && <span style={{ fontSize: 18, lineHeight: 1.5, flexShrink: 0 }}>{block.icon}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--color-text-primary)" }}>
              <RichText spans={block.rich} />
            </div>
            {block.children && <BlockList blocks={block.children} />}
          </div>
        </div>
      );
    case "code":
      return (
        <pre
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
          <code>{(block.rich ?? []).map((s) => s.text).join("")}</code>
        </pre>
      );
    case "image":
      return (
        <figure style={{ margin: "14px 0" }}>
          {block.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.url}
              alt={(block.caption ?? []).map((s) => s.text).join("") || ""}
              style={{ width: "100%", borderRadius: 12, display: "block" }}
            />
          )}
          {block.caption && block.caption.length > 0 && (
            <figcaption style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6, textAlign: "center" }}>
              <RichText spans={block.caption} />
            </figcaption>
          )}
        </figure>
      );
    case "video":
      return <VideoBlock url={block.url ?? null} />;
    case "embed":
    case "bookmark":
    case "link_preview":
      return block.url ? (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            padding: "12px 16px",
            margin: "10px 0",
            color: "var(--color-brand)",
            textDecoration: "none",
            fontSize: 14,
            wordBreak: "break-all",
            background: "white",
          }}
        >
          {block.url}
        </a>
      ) : null;
    case "toggle":
      return <Toggle block={block} />;
    case "divider":
      return <hr style={{ border: "none", borderTop: "1px solid var(--color-border-default)", margin: "20px 0" }} />;
    case "column_list":
      return (
        <div className="flex flex-col md:flex-row gap-4" style={{ margin: "12px 0" }}>
          {(block.children ?? []).map((col) => (
            <div key={col.id} style={{ flex: 1, minWidth: 0 }}>
              <BlockList blocks={col.children ?? []} />
            </div>
          ))}
        </div>
      );
    case "to_do":
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "4px 0" }}>
          <input type="checkbox" checked={block.checked} readOnly style={{ marginTop: 5, accentColor: "var(--color-brand)" }} />
          <span style={{ ...paragraphStyle, margin: 0, textDecoration: block.checked ? "line-through" : "none" }}>
            <RichText spans={block.rich} />
          </span>
        </div>
      );
    default:
      return null;
  }
}

// Regroupe les list items consécutifs en <ul>/<ol> et délègue le reste.
function BlockList({ blocks }: { blocks: NotionBlock[] }) {
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
          style={{
            margin: "8px 0",
            paddingLeft: 22,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {group.map((item) => (
            <li key={item.id} style={{ ...paragraphStyle, margin: 0 }}>
              <RichText spans={item.rich} />
              {item.children && item.children.length > 0 && <BlockList blocks={item.children} />}
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

export function NotionBlocks({ blocks }: { blocks: NotionBlock[] }) {
  if (!blocks || blocks.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", fontStyle: "italic" }}>
        Ce cours n&apos;a pas encore de contenu.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <BlockList blocks={blocks} />
    </div>
  );
}
