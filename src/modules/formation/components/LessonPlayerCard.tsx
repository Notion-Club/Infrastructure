"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Check,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  Lightbulb,
  Pencil,
  Play,
  Video as VideoIcon,
} from "lucide-react";

import { saveCourseNote } from "../server/actions";

type Tab = "notes" | "synthese";

type Props = {
  title: string;
  description: string | null;
  videoUrl: string | null;
  synthese: string;
  courseId: string;
  initialNote: string;
};

// Carte « player » : header (titre) ▸ description + vidéo ▸ switcher
// Notes / À garder en tête. Mime un lecteur vidéo (coins arrondis, header
// séparé). Largeur pleine de la colonne centrale.
export function LessonPlayerCard({
  title,
  description,
  videoUrl,
  synthese,
  courseId,
  initialNote,
}: Props) {
  const [tab, setTab] = useState<Tab>("notes");

  return (
    <div
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "var(--nc-shadow-2)",
      }}
    >
      {/* Header — titre séparé du corps par une bordure */}
      <header
        style={{
          padding: "16px 22px",
          borderBottom: "1px solid var(--color-border-default)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--color-surface-raised)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--color-brand)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Play size={14} fill="white" strokeWidth={0} />
        </span>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>
      </header>

      {/* Corps : description + vidéo */}
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
        {description && (
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            {description}
          </p>
        )}

        <VideoEmbed url={videoUrl} title={title} />

        {/* Switcher Notes / À garder en tête */}
        <div
          style={{
            display: "flex",
            background: "var(--color-surface-raised)",
            borderRadius: 10,
            padding: 3,
            gap: 2,
          }}
        >
          <SwitchButton
            active={tab === "notes"}
            onClick={() => setTab("notes")}
            icon={<Pencil size={15} strokeWidth={tab === "notes" ? 2.5 : 2} />}
            label="Mes notes"
          />
          <SwitchButton
            active={tab === "synthese"}
            onClick={() => setTab("synthese")}
            icon={<Lightbulb size={15} strokeWidth={tab === "synthese" ? 2.5 : 2} />}
            label="À garder en tête"
          />
        </div>

        {tab === "notes" ? (
          <RichTextNotes courseId={courseId} initialNote={initialNote} />
        ) : (
          <SynthesePanel synthese={synthese} />
        )}
      </div>
    </div>
  );
}

function SwitchButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        padding: "8px 16px",
        borderRadius: 8,
        border: "none",
        background: active ? "var(--nc-segmented-active-bg)" : "transparent",
        boxShadow: active
          ? "0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)"
          : "none",
        color: active ? "var(--nc-segmented-active-text)" : "var(--color-text-muted)",
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "background 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease), color 200ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Vidéo (Tella en iframe, fichier brut en <video>) ───────────────────

function tellaEmbedUrl(url: string): string | null {
  const m = url.match(/tella\.tv\/video\/([^/?#]+)/);
  if (!m) return null;
  return `https://www.tella.tv/video/${m[1]}/embed`;
}

function VideoEmbed({ url, title }: { url: string | null; title: string }) {
  if (!url) return null;
  const tella = tellaEmbedUrl(url);
  const isFile = /\.(mp4|webm|mov)(\?|$)/i.test(url) && !tella;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: 14,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {isFile ? (
        <video src={url} controls style={{ width: "100%", height: "100%" }} />
      ) : (
        <iframe
          src={tella ?? url}
          title={title}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      )}
    </div>
  );
}

// ─── Onglet « À garder en tête » (Synthèse, lecture seule) ──────────────

function SynthesePanel({ synthese }: { synthese: string }) {
  return (
    <div
      style={{
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 14,
        padding: 18,
        minHeight: 140,
      }}
    >
      {synthese.trim() ? (
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: "var(--color-text-primary)",
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {synthese}
        </p>
      ) : (
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          La synthèse de ce cours n&apos;est pas encore disponible.
        </p>
      )}
    </div>
  );
}

// ─── Onglet « Mes notes » (rich text auto-save) ─────────────────────────

const MAX = 50_000;

function RichTextNotes({
  courseId,
  initialNote,
}: {
  courseId: string;
  initialNote: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState(false);
  const [empty, setEmpty] = useState(initialNote.trim() === "");

  // Init du contenu une seule fois (contentEditable non contrôlé).
  useEffect(() => {
    if (editorRef.current && initialNote) {
      editorRef.current.innerHTML = initialNote;
    }
  }, [initialNote]);

  function persist() {
    const html = editorRef.current?.innerHTML ?? "";
    setEmpty((editorRef.current?.textContent ?? "").trim() === "" && !html.includes("<img") && !html.includes("<iframe"));
    setSaved(false);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      await saveCourseNote(courseId, html.slice(0, MAX));
      setSaved(true);
    }, 800);
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    persist();
  }

  function addLink() {
    const url = window.prompt("URL du lien :");
    if (url) exec("createLink", url);
  }
  function addImage() {
    const url = window.prompt("URL de l'image :");
    if (url) exec("insertImage", url);
  }
  function addVideo() {
    const url = window.prompt("URL de la vidéo (YouTube, Tella, Loom…) :");
    if (!url) return;
    editorRef.current?.focus();
    const src = tellaEmbedUrl(url) ?? url;
    document.execCommand(
      "insertHTML",
      false,
      `<div style="position:relative;width:100%;aspect-ratio:16/9;margin:8px 0;border-radius:10px;overflow:hidden;"><iframe src="${src}" allowfullscreen style="width:100%;height:100%;border:0;"></iframe></div><p><br/></p>`,
    );
    persist();
  }

  return (
    <div
      style={{
        border: "1px solid var(--color-border-default)",
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--color-surface-card)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "8px 10px",
          borderBottom: "1px solid var(--color-border-default)",
          background: "var(--color-surface-raised)",
        }}
      >
        <ToolbarButton onClick={() => exec("bold")} title="Gras">
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Italique">
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Liste">
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={addLink} title="Lien">
          <LinkIcon size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="Image">
          <ImageIcon size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={addVideo} title="Vidéo">
          <VideoIcon size={15} />
        </ToolbarButton>

        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: saved ? "var(--color-brand)" : "var(--color-text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            opacity: saved ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        >
          <Check size={12} /> Sauvegardé
        </span>
      </div>

      {/* Zone éditable */}
      <div style={{ position: "relative" }}>
        {empty && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 14,
              left: 16,
              fontSize: 14,
              color: "var(--color-text-muted)",
              pointerEvents: "none",
            }}
          >
            Note ici ce que tu retiens de cette leçon…
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={persist}
          role="textbox"
          aria-multiline="true"
          aria-label="Mes notes"
          className="nc-notes-editor"
          style={{
            minHeight: 180,
            padding: 16,
            fontSize: 14,
            lineHeight: 1.7,
            color: "var(--color-text-primary)",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // onMouseDown preventDefault : garde le focus/sélection dans l'éditeur
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "none",
        background: "transparent",
        color: "var(--color-text-secondary)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 150ms ease",
      }}
      className="hover:bg-[var(--color-border-default)]"
    >
      {children}
    </button>
  );
}
