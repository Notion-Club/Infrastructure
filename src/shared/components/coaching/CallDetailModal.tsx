"use client";

// Modale "Détail du coaching" avec 2 onglets (style Notion AI) :
//   - Résumé : le `Résumé IA` (rich_text de la propriété Notion) parsé en
//     sections (titres MAJUSCULES détectés) + paragraphes.
//   - Transcript : les blocs Notion de la page (transcription complète),
//     lazy-loadés au 1er clic sur l'onglet.
//
// L'onglet Transcript n'appelle la Server Action qu'au mount initial — un
// changement d'onglet → onglet Résumé puis retour ne refait pas l'appel.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// Subscribe no-op : on n'a besoin de re-render qu'au mount initial — le store
// ne change jamais après. useSyncExternalStore appelle getServerSnapshot
// côté SSR (false) et getSnapshot côté client (true), évitant l'écueil
// du setState-in-effect sans déclencher de hydration mismatch.
function subscribeToMount(): () => void {
  return () => {};
}
import { X, FileText, Sparkles } from "lucide-react";
import { MacOSWindowBar } from "@/shared/components/ui/MacOSWindowBar";
import { NotionBlocks } from "@/shared/components/notion/NotionBlocks";
import type { NotionBlock } from "@/shared/lib/notion/blocks";
import { getCallTranscriptionBlocks } from "@/modules/coaching/server/getCallTranscriptionBlocks";

interface CallDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  summary: string;
  host: string;
  date: string;
  notionPageId: string | null; // null → onglet Transcript indisponible
}

type Tab = "summary" | "transcript";

type TranscriptState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; blocks: NotionBlock[] }
  | { kind: "empty" }
  | { kind: "error"; reason: string };

// Détecte les lignes qui ressemblent à des titres de section :
//  - "SECTION 1 — TITRE"     (commun dans les résumés Notion AI)
//  - "TITRE EN MAJUSCULES"
// Une "ligne titre" : tout en majuscules OU commence par "SECTION N —".
function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 100) return false;
  if (/^SECTION\s+\d+\s*[—-]/i.test(trimmed)) return true;
  const letters = trimmed.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
  return false;
}

function formatDateLong(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return datePart.charAt(0).toUpperCase() + datePart.slice(1);
}

// Parse le résumé plain text en blocs heading/paragraph.
function parseSummary(
  raw: string,
): Array<{ kind: "heading" | "paragraph"; text: string }> {
  const lines = raw.split(/\r?\n/);
  const out: Array<{ kind: "heading" | "paragraph"; text: string }> = [];
  let buffer: string[] = [];
  const flush = () => {
    const joined = buffer.join("\n").trim();
    if (joined.length > 0) out.push({ kind: "paragraph", text: joined });
    buffer = [];
  };
  for (const line of lines) {
    if (isHeadingLine(line)) {
      flush();
      out.push({ kind: "heading", text: line.trim() });
    } else if (line.trim() === "") {
      flush();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return out;
}

export function CallDetailModal({
  isOpen,
  onClose,
  subject,
  summary,
  host,
  date,
  notionPageId,
}: CallDetailModalProps) {
  const [tab, setTab] = useState<Tab>("summary");
  const [transcript, setTranscript] = useState<TranscriptState>({
    kind: "idle",
  });
  // Empêche le ré-fetch du transcript quand l'utilisateur switch d'onglet
  // Résumé → Transcript → Résumé → Transcript : on garde la ref du fetch
  // déjà déclenché. Une ref (et non une dépendance d'effect) — sinon le
  // changement d'état "idle → loading → ready" relance l'effect et le
  // cleanup annule le fetch en cours.
  const transcriptFetchStartedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Portal vers document.body pour échapper au stacking context créé par
  // .nc-page-halo (isolation: isolate) — sinon les cards voisines passent
  // par-dessus la modale. SSR-safe : false côté server (pas de document),
  // true au mount client.
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );

  // Reset état de la modale à la fermeture (onglet, ref de fetch, transcript)
  // puis propage. handleClose est défini tôt pour pouvoir être référencé dans
  // l'effect Esc ci-dessous.
  const handleClose = useCallback(() => {
    setTab("summary");
    transcriptFetchStartedRef.current = false;
    setTranscript({ kind: "idle" });
    onClose();
  }, [onClose]);

  // Esc → close.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  // Lock body scroll quand ouverte.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Lazy load du Transcript quand l'onglet est ouvert pour la 1re fois.
  // Important : `transcript.kind` n'est PAS dans les dépendances — sinon le
  // setTranscript("loading") relance l'effect, dont le cleanup annule le
  // fetch via `cancelled = true` avant que la Server Action ne réponde.
  // On utilise une ref pour idempotence (1 seul fetch par ouverture).
  useEffect(() => {
    if (!isOpen) return;
    if (tab !== "transcript") return;
    if (!notionPageId) return;
    if (transcriptFetchStartedRef.current) return;
    transcriptFetchStartedRef.current = true;
    let cancelled = false;
    (async () => {
      // setState via microtask : sort du corps synchrone de l'effect (eslint
      // react-hooks/set-state-in-effect) tout en restant immédiat pour
      // l'utilisateur.
      await Promise.resolve();
      if (cancelled) return;
      setTranscript({ kind: "loading" });
      try {
        const result = await getCallTranscriptionBlocks(notionPageId);
        if (cancelled) return;
        if (!result.ok) {
          setTranscript({ kind: "error", reason: result.reason });
          return;
        }
        setTranscript(
          result.blocks.length === 0
            ? { kind: "empty" }
            : { kind: "ready", blocks: result.blocks },
        );
      } catch (err) {
        if (cancelled) return;
        console.error("[CallDetailModal] transcript fetch failed:", err);
        setTranscript({ kind: "error", reason: "fetch_failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, tab, notionPageId]);


  if (!isOpen || !mounted) return null;

  const summaryBlocks = parseSummary(summary);
  const hasTranscriptAccess = !!notionPageId;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) handleClose();
  }

  return createPortal(
    <div
      onClick={handleOverlayClick}
      data-fb-label="Modale détail · Carte appel"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: "16px",
      }}
    >
      <div
        ref={containerRef}
        data-fb-label="Fenêtre détail · Modale détail"
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "88vh",
          background: "var(--color-surface-card)",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "nc-modal-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <MacOSWindowBar onClose={handleClose} />

        {/* Header — titre + métadonnées */}
        <div
          style={{
            padding: "20px 28px 0",
          }}
        >
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
            }}
          >
            {subject}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
              margin: 0,
              marginTop: 4,
            }}
          >
            {formatDateLong(date)} avec <strong>{host}</strong>
          </p>
        </div>

        {/* Onglets */}
        <div
          role="tablist"
          aria-label="Sections du détail du coaching"
          style={{
            display: "flex",
            gap: 4,
            padding: "16px 28px 0",
            borderBottom: "1px solid var(--color-border-default)",
          }}
        >
          <TabButton
            active={tab === "summary"}
            onClick={() => setTab("summary")}
            icon={<Sparkles size={14} />}
            label="Résumé"
          />
          {hasTranscriptAccess && (
            <TabButton
              active={tab === "transcript"}
              onClick={() => setTab("transcript")}
              icon={<FileText size={14} />}
              label="Transcript"
            />
          )}
        </div>

        {/* Body — contenu de l'onglet actif */}
        <div
          style={{
            padding: "20px 28px 12px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {tab === "summary" && <SummaryPanel blocks={summaryBlocks} />}
          {tab === "transcript" && <TranscriptPanel state={transcript} />}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 28px",
            borderTop: "1px solid var(--color-border-default)",
            background: "var(--color-surface-raised)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>⚠️</span>
            <span>Contenu généré par IA, peut contenir des imprécisions</span>
          </p>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              background: "transparent",
              border: "1px solid var(--color-border-default)",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              cursor: "pointer",
            }}
          >
            <X size={13} />
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Sous-composants ──────────────────────────────────────────────────────

function TabButton({
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-fb-label={`Onglet ${label} · Modale détail`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 14px",
        background: active ? "rgba(0,0,0,0.05)" : "transparent",
        border: "none",
        borderRadius: "8px 8px 0 0",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active
          ? "var(--color-text-primary)"
          : "var(--color-text-muted)",
        cursor: "pointer",
        position: "relative",
        bottom: -1,
        transition: "background 160ms ease, color 160ms ease",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryPanel({
  blocks,
}: {
  blocks: Array<{ kind: "heading" | "paragraph"; text: string }>;
}) {
  if (blocks.length === 0) {
    return (
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
          margin: 0,
        }}
      >
        Pas de résumé disponible.
      </p>
    );
  }
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === "heading" ? (
          <h3
            key={i}
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: i === 0 ? "0 0 10px" : "22px 0 10px",
              letterSpacing: "-0.01em",
            }}
          >
            {b.text}
          </h3>
        ) : (
          <p
            key={i}
            style={{
              fontSize: 14.5,
              lineHeight: 1.65,
              color: "var(--color-text-secondary)",
              margin: "0 0 14px",
              whiteSpace: "pre-wrap",
            }}
          >
            {b.text}
          </p>
        ),
      )}
    </>
  );
}

function TranscriptPanel({ state }: { state: TranscriptState }) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
          margin: 0,
        }}
      >
        Chargement de la transcription…
      </p>
    );
  }
  if (state.kind === "empty") {
    return (
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
          margin: 0,
        }}
      >
        La transcription n&apos;est pas encore disponible pour ce coaching.
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
          margin: 0,
        }}
      >
        Impossible de charger la transcription
        {state.reason === "forbidden" ? " (accès refusé)" : ""}.
      </p>
    );
  }
  return <NotionBlocks blocks={state.blocks} />;
}
