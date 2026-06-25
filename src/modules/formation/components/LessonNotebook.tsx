"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Lightbulb,
  Video as VideoIcon,
} from "lucide-react";

import {
  Bold,
  BookWrench,
  CharacterTextboxSparkles,
  Italic,
  Link,
  ListBullet,
  PencilScribble,
  Photo,
  SparkleClipboard,
  Templates,
} from "@/shared/components/icons";

import { toEmbedSrc } from "@/shared/lib/notion/video";
import type { LessonResourceLink } from "../server/notion";
import { saveCourseNote } from "../server/actions";

type Tab = "notes" | "synthese" | "resources";

const NOTEBOOK_TABS: Tab[] = ["notes", "synthese", "resources"];

type Props = {
  synthese: string;
  resources: LessonResourceLink[];
  courseId: string;
  initialNote: string;
};

// Carnet de la leçon — 3e partie de la carte player (LessonPlayerCard) : un
// bloc switcher 3 onglets (Mes notes / À garder en tête / Ressources) rendu en
// PLEINE LARGEUR, collé à ras en bas de la carte (séparé du body par un filet).
export function LessonNotebook({ synthese, resources, courseId, initialNote }: Props) {
  const [tab, setTab] = useState<Tab>("notes");

  const itemRefs       = useRef<(HTMLButtonElement | null)[]>([]);
  const pillRef        = useRef<HTMLDivElement>(null);
  const lastClickedRef = useRef<number>(-1);

  const moveTo = useCallback((idx: number, animate: boolean) => {
    const el   = itemRefs.current[idx];
    const pill = pillRef.current;
    if (!el || !pill) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = prev;
    } else {
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
    }
  }, []);

  useLayoutEffect(() => {
    const idx = NOTEBOOK_TABS.indexOf(tab);
    if (lastClickedRef.current === idx) {
      lastClickedRef.current = -1;
      return;
    }
    lastClickedRef.current = -1;
    moveTo(idx, false);
  }, [tab, moveTo]);

  return (
    <div
      data-fb-label="Carnet de leçon · Notebook leçon"
      style={{
        borderTop: "1px solid var(--color-border-default)",
        background: "var(--color-surface-raised)",
      }}
    >
      {/* Onglets */}
      <div
        data-fb-label="Onglets du carnet · Notebook leçon"
        style={{
          display: "flex",
          gap: 2,
          padding: 6,
          borderBottom: "1px solid var(--color-border-default)",
          position: "relative",
        }}
      >
        {/* Pill glissante */}
        <div
          ref={pillRef}
          aria-hidden
          className="nc-nav-pill"
          style={{
            position: "absolute",
            left: 0,
            background: "var(--nc-segmented-active-bg)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)",
            borderRadius: 8,
            pointerEvents: "none",
            willChange: "transform, width",
            zIndex: 0,
          }}
        />
        <SwitchButton
          buttonRef={(el) => { itemRefs.current[0] = el; }}
          active={tab === "notes"}
          onClick={() => { lastClickedRef.current = 0; moveTo(0, true); setTab("notes"); }}
          icon={<PencilScribble size={15} />}
          label="Mes notes"
        />
        <SwitchButton
          buttonRef={(el) => { itemRefs.current[1] = el; }}
          active={tab === "synthese"}
          onClick={() => { lastClickedRef.current = 1; moveTo(1, true); setTab("synthese"); }}
          icon={<CharacterTextboxSparkles size={15} />}
          label="À garder en tête"
        />
        <SwitchButton
          buttonRef={(el) => { itemRefs.current[2] = el; }}
          active={tab === "resources"}
          onClick={() => { lastClickedRef.current = 2; moveTo(2, true); setTab("resources"); }}
          icon={<BookWrench size={15} />}
          label="Ressources"
          badge={resources.length}
        />
      </div>

      {/* Panneau attaché — coulé directement sous les onglets */}
      {tab === "notes" && <RichTextNotes courseId={courseId} initialNote={initialNote} />}
      {tab === "synthese" && <SynthesePanel synthese={synthese} />}
      {tab === "resources" && <ResourcesPanel items={resources} />}
    </div>
  );
}

function SwitchButton({
  active,
  onClick,
  icon,
  label,
  badge,
  buttonRef,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      data-fb-label={`Onglet « ${label} » · Notebook leçon`}
      style={{
        flex: 1,
        // minWidth:0 → les 3 onglets peuvent rétrécir et se partager la largeur
        // à égalité ; le label tronque au lieu de déborder (fix mobile Ressources).
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 6px",
        borderRadius: 8,
        border: "none",
        background: active ? "var(--nc-segmented-active-bg)" : "transparent",
        boxShadow: active ? "0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)" : "none",
        color: active ? "var(--nc-segmented-active-text)" : "var(--color-text-muted)",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        position: "relative",
        zIndex: 1,
        transition: "background 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease), color 200ms ease",
      }}
    >
      <span style={{ flexShrink: 0, display: "inline-flex" }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            flexShrink: 0,
            minWidth: 16,
            height: 16,
            background: "var(--color-brand)",
            color: "#fff",
            borderRadius: 9999,
            fontSize: 10,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Empty state réutilisable (icône + message centrés) ─────────────────

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        padding: "40px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: "var(--color-surface-card)",
          color: "var(--color-text-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={22} />
      </span>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
          {title}
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            margin: "4px 0 0 0",
            maxWidth: 300,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── Onglet « À garder en tête » (Synthèse, lecture seule) ──────────────

function SynthesePanel({ synthese }: { synthese: string }) {
  if (!synthese.trim()) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Pas encore de synthèse"
        subtitle="Le récapitulatif des points clés de ce cours arrivera bientôt ici."
      />
    );
  }
  return (
    <div style={{ padding: "20px 22px" }}>
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
    </div>
  );
}

// ─── Onglet « Ressources » ───────────────────────────────────────────────

const CATEGORY: Record<
  LessonResourceLink["category"],
  { label: string; bg: string; color: string; dot: string }
> = {
  resource: { label: "Ressource", bg: "rgba(37,99,235,0.10)", color: "#1d4ed8", dot: "#3b82f6" },
  template: { label: "Template", bg: "rgba(124,58,237,0.10)", color: "#6d28d9", dot: "#8b5cf6" },
};

function ResourcesPanel({ items }: { items: LessonResourceLink[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={SparkleClipboard}
        title="Aucune ressource liée"
        subtitle="Les ressources et templates rattachés à ce cours apparaîtront ici."
      />
    );
  }
  return (
    <div>
      {items.map((item, i) => {
        const cat = CATEGORY[item.category];
        const Icon = item.category === "template" ? Templates : SparkleClipboard;
        return (
          <a
            key={item.notionId}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group hover:bg-[var(--color-surface-card)]"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 18px",
              textDecoration: "none",
              borderTop: i === 0 ? "none" : "1px solid var(--color-border-default)",
              transition: "background 200ms var(--nc-ease)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "var(--color-surface-card)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "var(--color-text-secondary)",
              }}
            >
              <Icon size={16} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.title}
              </p>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 5,
                  padding: "3px 10px 3px 8px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  background: cat.bg,
                  color: cat.color,
                }}
              >
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: cat.dot }} />
                {cat.label}
              </span>
            </div>
            <ArrowUpRight
              size={18}
              strokeWidth={2.25}
              className="nc-resource-arrow"
              style={{ color: "var(--color-brand)", flexShrink: 0 }}
            />
          </a>
        );
      })}
    </div>
  );
}

// ─── Onglet « Mes notes » (rich text auto-save) ─────────────────────────

const MAX = 50_000;

function RichTextNotes({ courseId, initialNote }: { courseId: string; initialNote: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState(false);
  const [empty, setEmpty] = useState(initialNote.trim() === "");

  useEffect(() => {
    if (editorRef.current && initialNote) {
      editorRef.current.innerHTML = initialNote;
    }
  }, [initialNote]);

  function persist() {
    const el = editorRef.current;
    const html = el?.innerHTML ?? "";
    const hasMedia = html.includes("<img") || html.includes("<iframe");
    setEmpty((el?.textContent ?? "").trim() === "" && !hasMedia);
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
    const src = toEmbedSrc(url);
    document.execCommand(
      "insertHTML",
      false,
      `<div style="position:relative;width:100%;aspect-ratio:16/9;margin:8px 0;border-radius:10px;overflow:hidden;"><iframe src="${src}" allowfullscreen style="width:100%;height:100%;border:0;"></iframe></div><p><br/></p>`,
    );
    persist();
  }

  return (
    <div>
      {/* Toolbar — collée sous les onglets */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "6px 10px",
          borderBottom: "1px solid var(--color-border-default)",
        }}
      >
        <ToolbarButton onClick={() => exec("bold")} title="Gras"><Bold size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Italique"><Italic size={15} /></ToolbarButton>
        <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Liste"><ListBullet size={15} /></ToolbarButton>
        <ToolbarButton onClick={addLink} title="Lien"><Link size={15} /></ToolbarButton>
        <ToolbarButton onClick={addImage} title="Image"><Photo size={15} /></ToolbarButton>
        <ToolbarButton onClick={addVideo} title="Vidéo"><VideoIcon size={15} /></ToolbarButton>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--color-brand)",
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

      {/* Zone éditable (fond surface-raised, distinct de la carte) */}
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
            minHeight: 160,
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
