"use client";

// Modale « Détail de l'appel » restylée façon page Notion :
//   1. Titre = sujet de l'appel
//   2. Ligne de propriétés : Date · Host (avatar + nom) — pas de Status,
//      pas de Membre, pas d'« Objet » (porté par le titre)
//   3. Switcher onglets en pilules glissantes (CoachingTabs) :
//      Plan d'actions / Transcription
//   4. Contenu de l'onglet actif
//   5. Barre d'action persistante (tous onglets) : Demander à Claude /
//      Demander à ChatGPT — pas de Fathom.
//
// L'onglet Transcription lazy-load les blocs Notion au 1er affichage.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { MacOSWindowBar } from "@/shared/components/ui/MacOSWindowBar";
import { NotionBlocks } from "@/shared/components/notion/NotionBlocks";
import { CoachingTabs } from "@/shared/components/coaching/CoachingTabs";
import type { NotionBlock } from "@/shared/lib/notion/blocks";
import { getCallTranscriptionBlocks } from "@/modules/coaching/server/getCallTranscriptionBlocks";

// Subscribe no-op : re-render uniquement au mount initial (le store ne change
// jamais). Évite l'écueil setState-in-effect sans hydration mismatch.
function subscribeToMount(): () => void {
  return () => {};
}

const CHATGPT_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1776436270/ChatGPT-Logo.svg_rip8m0.png";
const CLAUDE_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777030411/IMG_1961_flp3vm.png";

const HOST_FALLBACK: Record<string, { initials: string; bg: string }> = {
  Théo: { initials: "TG", bg: "#e0625a" },
  Noah: { initials: "NL", bg: "#7c3aed" },
};

// Prompt partagé pour Claude et ChatGPT — les 2 ont un outil web qui fetche
// l'URL passée. Côté ChatGPT, on déclenche en plus le mode SearchGPT via
// `hints=search` (cf. buildChatGPTUrl) qui force l'activation du browse tool
// dès l'ouverture du chat — sans ça il refusait de fetcher.
function buildAIPrompt(host: string, transcriptUrl: string): string {
  return `Ouvre cette page web publique avec ton outil de navigation web, lis l'intégralité de la transcription qui s'y trouve, puis aide-moi à en tirer des actions concrètes et réponds à mes questions de suivi sur mon appel coaching avec ${host} (notionclub.fr).

Page à lire : ${transcriptUrl}

Cette URL est un lien public — tu peux et dois la fetch via ton outil web. Ce n'est pas une ressource protégée nécessitant une authentification.`;
}

// URL ChatGPT avec mode search activé (force le browse tool) + chat éphémère
// (pas de pollution de l'historique pour un usage one-shot).
//
// Paramètres documentés par la communauté OpenAI :
//   - hints=search        → active SearchGPT (browse tool ON dès l'ouverture)
//   - temporary-chat=true → chat éphémère
//   - q=<prompt>          → message initial
function buildChatGPTUrl(prompt: string): string {
  return `https://chatgpt.com/?hints=search&temporary-chat=true&q=${encodeURIComponent(prompt)}`;
}

function buildClaudeUrl(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

interface CallDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  summary: string;
  host: string;
  hostAvatarUrl: string | null;
  date: string;
  notionPageId: string | null; // null → onglet Transcription indisponible
  transcriptUrl: string | null; // null → barre d'action IA masquée
}

type Tab = "summary" | "transcript";

type TranscriptState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; blocks: NotionBlock[] }
  | { kind: "empty" }
  | { kind: "error"; reason: string };

// Détecte les lignes qui ressemblent à des titres de section.
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
  hostAvatarUrl,
  date,
  notionPageId,
  transcriptUrl,
}: CallDetailModalProps) {
  const [tab, setTab] = useState<Tab>("summary");
  const [transcript, setTranscript] = useState<TranscriptState>({
    kind: "idle",
  });
  const transcriptFetchStartedRef = useRef(false);
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );

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

  // Lazy load du Transcript au 1er affichage de l'onglet (ref = idempotence).
  useEffect(() => {
    if (!isOpen) return;
    if (tab !== "transcript") return;
    if (!notionPageId) return;
    if (transcriptFetchStartedRef.current) return;
    transcriptFetchStartedRef.current = true;
    let cancelled = false;
    (async () => {
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
  const hasAiBar = !!transcriptUrl;
  const fallback =
    HOST_FALLBACK[host] ?? {
      initials: host[0]?.toUpperCase() ?? "?",
      bg: "#6b7280",
    };

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) handleClose();
  }

  return createPortal(
    <>
      <div
        onClick={handleOverlayClick}
        data-fb-label="Modale détail · Coaching"
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

          {/* En-tête façon page Notion — titre + ligne de propriétés */}
          <div style={{ padding: "20px 28px 0" }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--color-text-primary)",
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              {subject}
            </h2>

            {/* Ligne de propriétés : Date · Host */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{ fontSize: 13, color: "var(--color-text-muted)" }}
              >
                {formatDateLong(date)}
              </span>
              <span
                aria-hidden
                style={{ color: "var(--color-border-default)" }}
              >
                ·
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: fallback.bg,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {hostAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hostAvatarUrl}
                      alt={host}
                      width={20}
                      height={20}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: "#fff",
                        lineHeight: 1,
                      }}
                    >
                      {fallback.initials}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {host}
                </span>
              </span>
            </div>
          </div>

          {/* Switcher onglets — pilules glissantes (masqué si pas de transcript) */}
          {hasTranscriptAccess && (
            <div style={{ padding: "16px 28px 0" }}>
              <CoachingTabs<Tab>
                ariaLabel="Sections du détail de l'appel"
                active={tab}
                onChange={setTab}
                tabs={[
                  { value: "summary", label: "Plan d'actions" },
                  { value: "transcript", label: "Transcription" },
                ]}
              />
            </div>
          )}

          {/* Body — contenu de l'onglet actif */}
          <div
            style={{
              padding: "18px 28px 12px",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {tab === "summary" && <SummaryPanel blocks={summaryBlocks} />}
            {tab === "transcript" && <TranscriptPanel state={transcript} />}
          </div>

          {/* Barre d'action persistante — Demander à Claude / ChatGPT */}
          {hasAiBar && (
            <div
              data-fb-label="Barre d'action IA · Modale détail"
              style={{
                padding: "12px 28px",
                borderTop: "1px solid var(--color-border-default)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <a
                href={buildChatGPTUrl(buildAIPrompt(host, transcriptUrl!))}
                target="_blank"
                rel="noopener noreferrer"
                data-fb-label="Bouton Demander à ChatGPT · Modale détail"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "9px 12px",
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  textDecoration: "none",
                  transition:
                    "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                }}
                className="hover:bg-[#f0fdf4] hover:border-[#86efac] hover:shadow-[0_2px_8px_rgba(34,197,94,0.12)] dark:hover:bg-[rgba(34,197,94,0.07)] dark:hover:border-[rgba(134,239,172,0.2)] dark:hover:shadow-none"
              >
                <Image
                  src={CHATGPT_LOGO}
                  alt=""
                  width={15}
                  height={15}
                  style={{ display: "block", flexShrink: 0 }}
                />
                Demander à ChatGPT
              </a>

              <a
                href={buildClaudeUrl(buildAIPrompt(host, transcriptUrl!))}
                target="_blank"
                rel="noopener noreferrer"
                data-fb-label="Bouton Demander à Claude · Modale détail"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "9px 12px",
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  textDecoration: "none",
                  transition:
                    "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                }}
                className="hover:bg-[#fff8f7] hover:border-[rgba(224,98,90,0.35)] hover:shadow-[0_2px_8px_rgba(224,98,90,0.12)] dark:hover:bg-[rgba(224,98,90,0.07)] dark:hover:border-[rgba(224,98,90,0.28)] dark:hover:shadow-none"
              >
                <Image
                  src={CLAUDE_LOGO}
                  alt=""
                  width={15}
                  height={15}
                  style={{ display: "block", flexShrink: 0, borderRadius: 3 }}
                />
                Demander à Claude
              </a>
            </div>
          )}

          {/* Footer — warning IA + fermer */}
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
                flexShrink: 0,
              }}
            >
              <X size={13} />
              Fermer
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── Sous-composants ──────────────────────────────────────────────────────

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
        Plan d&apos;actions indisponible
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
  const italicMuted: React.CSSProperties = {
    fontSize: 14,
    color: "var(--color-text-muted)",
    fontStyle: "italic",
    margin: 0,
    lineHeight: 1.6,
  };

  if (state.kind === "idle" || state.kind === "loading") {
    return <p style={italicMuted}>2 secondes, on cherche la transcription</p>;
  }
  if (state.kind === "empty") {
    return (
      <p style={italicMuted}>Sorry, la transcription n&apos;est pas encore disponible</p>
    );
  }
  if (state.kind === "error") {
    return (
      <p style={italicMuted}>
        Sorry, il y a un bug. Impossible de charger la transcription.
        <br />
        Écris à @Théo
      </p>
    );
  }
  return <NotionBlocks blocks={state.blocks} />;
}
