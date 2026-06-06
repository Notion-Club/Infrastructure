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
import { X, Goal, FileText, Copy, Check } from "lucide-react";
import { MacOSWindowBar } from "@/shared/components/ui/MacOSWindowBar";
import { NotionBlocks } from "@/shared/components/notion/NotionBlocks";
import { CoachingTabs } from "@/shared/components/coaching/CoachingTabs";
import { ChatGPTGuideModal } from "@/shared/components/coaching/ChatGPTGuideModal";
import { TranscriptLoadingText } from "@/shared/components/coaching/TranscriptLoadingText";
import { GradualBlurOverlay } from "@/shared/components/GradualBlurOverlay";
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

// Prompt pour Claude (web fetch tool intégral) : on lui passe l'URL signée et
// il fetche la transcription complète.
function buildClaudePrompt(host: string, transcriptUrl: string): string {
  return `Ouvre cette page web publique avec ton outil de navigation web, lis l'intégralité de la transcription qui s'y trouve, puis aide-moi à en tirer des actions concrètes et réponds à mes questions de suivi sur mon appel coaching avec ${host} (notionclub.fr).

Page à lire : ${transcriptUrl}

Cette URL est un lien public — tu peux et dois la fetch via ton outil web. Ce n'est pas une ressource protégée nécessitant une authentification.`;
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
  const [chatgptGuideOpen, setChatgptGuideOpen] = useState(false);
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
                  {
                    value: "summary",
                    label: "Plan d'actions",
                    icon: <Goal size={15} />,
                  },
                  {
                    value: "transcript",
                    label: "Transcription",
                    icon: <FileText size={15} />,
                  },
                ]}
              />
            </div>
          )}

          {/* Body — contenu de l'onglet actif, avec flou progressif haut/bas
              (même effet que /ressources) pour estomper le contenu qui entre
              et sort de la zone scrollable. */}
          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "18px 28px 12px",
                overflowY: "auto",
                flex: 1,
              }}
            >
              {tab === "summary" && <SummaryPanel blocks={summaryBlocks} />}
              {tab === "transcript" && (
                <TranscriptPanel state={transcript} host={host} />
              )}
            </div>

            <GradualBlurOverlay position="absolute" edge="top" height={48} zIndex={4} />
            <GradualBlurOverlay position="absolute" edge="bottom" height={48} zIndex={4} />

            {/* Copier la transcription — onglet Transcription, contenu prêt */}
            {tab === "transcript" &&
              transcript.kind === "ready" &&
              transcriptUrl && (
                <div
                  style={{ position: "absolute", top: 12, right: 18, zIndex: 5 }}
                >
                  <CopyTranscriptButton transcriptUrl={transcriptUrl} />
                </div>
              )}
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
              <button
                type="button"
                onClick={() => setChatgptGuideOpen(true)}
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
                  cursor: "pointer",
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
              </button>

              <a
                href={`https://claude.ai/new?q=${encodeURIComponent(
                  buildClaudePrompt(host, transcriptUrl!),
                )}`}
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

      {/* Wizard ChatGPT (2 étapes Copier / Coller) */}
      {hasAiBar && (
        <ChatGPTGuideModal
          isOpen={chatgptGuideOpen}
          onClose={() => setChatgptGuideOpen(false)}
          transcriptUrl={transcriptUrl!}
          host={host}
        />
      )}
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

function TranscriptPanel({
  state,
  host,
}: {
  state: TranscriptState;
  host: string;
}) {
  const italicMuted: React.CSSProperties = {
    fontSize: 14,
    color: "var(--color-text-muted)",
    fontStyle: "italic",
    margin: 0,
    lineHeight: 1.6,
  };

  if (state.kind === "empty") {
    return (
      <p style={italicMuted}>
        Sorry, la transcription n&apos;est pas encore disponible
      </p>
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
  // idle | loading | ready → skeleton avec reveal du contenu réel.
  return <TranscriptReveal state={state} host={host} />;
}

// Skeleton de chargement (titre animé centré + lignes fondues par le haut)
// qui se cross-fade vers la vraie transcription quand elle arrive.
//
// Reste monté tout au long de idle → loading → ready (même position dans
// l'arbre) pour que le reveal lise comme un seul mouvement. Au passage en
// `ready` : on ajoute `is-revealing` (skeleton en overlay absolu) puis, à la
// frame suivante, `is-revealed` (déclenche le cross-fade). Le skeleton est
// démonté après la durée de reveal.
function TranscriptReveal({
  state,
  host,
}: {
  state: TranscriptState;
  host: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [skeletonGone, setSkeletonGone] = useState(false);
  const isReady = state.kind === "ready";

  useEffect(() => {
    if (!isReady) return;
    const el = wrapRef.current;
    if (!el) return;
    el.classList.add("is-revealing");
    // Reflow forcé : enregistre l'état initial (contenu opacity 0 + blur)
    // avant de déclencher la transition à la frame suivante.
    void el.offsetWidth;
    const raf = requestAnimationFrame(() => el.classList.add("is-revealed"));
    // Démonte le skeleton une fois le cross-fade terminé (≈ --reveal-dur).
    const timer = window.setTimeout(() => setSkeletonGone(true), 480);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [isReady]);

  return (
    <div ref={wrapRef} className="nc-transcript-skel t-skel">
      {!skeletonGone && (
        <div className="t-skel-skeleton" aria-hidden={isReady}>
          {/* Titre animé centré (gros, focal) */}
          <div style={{ textAlign: "center", padding: "24px 8px 0", marginBottom: 32 }}>
            <TranscriptLoadingText host={host} />
          </div>
          {/* Lignes skeleton — fondues par le haut pour une transition smooth */}
          <div
            aria-hidden
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0, #000 44px)",
              maskImage: "linear-gradient(to bottom, transparent 0, #000 44px)",
            }}
          >
            <SkeletonLines />
          </div>
        </div>
      )}

      {isReady && (
        <div className="t-skel-content">
          <NotionBlocks blocks={state.blocks} />
        </div>
      )}
    </div>
  );
}

// Lignes de texte mockées (2 blocs, largeurs variées) reprenant le pulse
// skeleton standard de l'app (`nc-skeleton-pulse`).
function SkeletonLines() {
  const lines: Array<{ w: string; gapTop?: number }> = [
    { w: "46%" },
    { w: "100%" },
    { w: "100%" },
    { w: "64%" },
    { w: "100%", gapTop: 22 },
    { w: "100%" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            height: 12,
            width: line.w,
            marginTop: line.gapTop ?? 0,
            borderRadius: 6,
            background: "var(--color-surface-raised)",
            animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
            animationDelay: `${i * 90}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Bouton « Copier la transcription » : fetch du lien signé + écriture
// presse-papiers, avec morph d'icône Copy → Check et état vert « Copié ! »
// (revient à l'état initial après ~2 s).
type CopyState = "idle" | "loading" | "copied" | "error";

function CopyTranscriptButton({ transcriptUrl }: { transcriptUrl: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    if (copyState === "loading") return;
    setCopyState("loading");
    try {
      const res = await fetch(transcriptUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch (err) {
      console.error("[CopyTranscriptButton] copy failed:", err);
      setCopyState("error");
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopyState("idle"), 2200);
  }

  const copied = copyState === "copied";
  const label =
    copyState === "loading"
      ? "Copie…"
      : copied
        ? "Copié !"
        : copyState === "error"
          ? "Réessayer"
          : "Copier";

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={copyState === "loading"}
      aria-label="Copier la transcription"
      data-fb-label="Bouton Copier transcription · Modale détail"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 13px",
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 600,
        cursor: copyState === "loading" ? "wait" : "pointer",
        background: copied
          ? "rgba(34,197,94,0.10)"
          : "var(--color-surface-card)",
        border: `1px solid ${
          copied ? "rgba(34,197,94,0.35)" : "var(--color-border-default)"
        }`,
        color: copied ? "#16a34a" : "var(--color-text-primary)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        transition:
          "background 220ms var(--nc-ease), border-color 220ms var(--nc-ease), color 220ms var(--nc-ease)",
      }}
    >
      {/* Morph d'icône Copy → Check */}
      <span
        style={{
          position: "relative",
          width: 15,
          height: 15,
          flexShrink: 0,
        }}
      >
        <Copy
          size={15}
          style={{
            position: "absolute",
            inset: 0,
            opacity: copied ? 0 : 1,
            transform: copied ? "scale(0.5)" : "scale(1)",
            transition:
              "opacity 200ms var(--nc-ease), transform 200ms var(--nc-ease)",
          }}
        />
        <Check
          size={15}
          style={{
            position: "absolute",
            inset: 0,
            color: "#16a34a",
            opacity: copied ? 1 : 0,
            transform: copied ? "scale(1)" : "scale(0.5)",
            transition:
              "opacity 200ms var(--nc-ease), transform 200ms var(--nc-ease)",
          }}
        />
      </span>
      {label}
    </button>
  );
}
