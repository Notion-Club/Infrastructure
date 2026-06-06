"use client";

// Wizard 2 étapes pour ChatGPT, qui ne peut pas fetch des URLs avec token long
// via son outil web (limite produit OpenAI — vérifié, il tronque ~30k chars
// sur des transcriptions de 67k).
//
// Étape 1 : "Copier la transcription" — fetch + clipboard write
// Étape 2 : "Ouvrir ChatGPT et coller" — redirect chat.com avec prompt pré-rempli
//
// L'user ouvre ChatGPT déjà loggé avec le prompt qui dit "voici la trans.,
// je vais la coller", colle (cmd+v), ChatGPT lit tout sans limite token web.
//
// Claude n'a pas besoin de ce flow — son bouton ouvre directement claude.ai
// avec l'URL dans le prompt (son outil web fetch correctement).

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { MacOSWindowBar } from "@/shared/components/ui/MacOSWindowBar";

// Subscribe no-op : on n'a besoin de re-render qu'au mount initial — le store
// ne change jamais après. useSyncExternalStore appelle getServerSnapshot
// côté SSR (false) et getSnapshot côté client (true), évitant l'écueil
// du setState-in-effect sans déclencher de hydration mismatch.
function subscribeToMount(): () => void {
  return () => {};
}

const CHATGPT_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1776436270/ChatGPT-Logo.svg_rip8m0.png";

interface ChatGPTGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcriptUrl: string;
  host: string;
}

type CopyState = "idle" | "loading" | "copied" | "error";

function buildChatGPTPrompt(host: string): string {
  return `Je vais te coller la transcription brute de mon appel coaching avec ${host} (notionclub.fr) juste après ce message.

Lis-la intégralement, puis aide-moi à en tirer des actions concrètes et réponds à mes questions de suivi.`;
}

export function ChatGPTGuideModal({
  isOpen,
  onClose,
  transcriptUrl,
  host,
}: ChatGPTGuideModalProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  // Portal vers document.body pour échapper au stacking context créé par
  // .nc-page-halo (isolation: isolate) — sinon les cards voisines passent
  // par-dessus la modale. SSR-safe : false côté server (pas de document),
  // true au mount client.
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );

  // Reset état au close pour que la prochaine ouverture reparte propre.
  const handleClose = useCallback(() => {
    setCopyState("idle");
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
      console.error("[ChatGPTGuideModal] copy failed:", err);
      setCopyState("error");
    }
  }

  if (!isOpen || !mounted) return null;

  // L'étape 2 est désactivée tant que l'user n'a pas copié — on guide
  // séquentiellement pour éviter qu'il ouvre ChatGPT sans rien à coller.
  const step2Disabled = copyState !== "copied";
  const chatgptUrl = `https://chatgpt.com/?q=${encodeURIComponent(buildChatGPTPrompt(host))}`;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) handleClose();
  }

  return createPortal(
    <div
      onClick={handleOverlayClick}
      data-fb-label="Modale guide ChatGPT · Carte appel"
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
        data-fb-label="Fenêtre guide ChatGPT · Modale guide"
        style={{
          width: "100%",
          maxWidth: 520,
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

        <div style={{ padding: "20px 28px 14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Image
              src={CHATGPT_LOGO}
              alt=""
              width={22}
              height={22}
              style={{ display: "block", flexShrink: 0 }}
            />
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--color-text-primary)",
                margin: 0,
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
              }}
            >
              Demander à ChatGPT
            </h2>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            ChatGPT ne lit pas les longs liens directement. Copie d&apos;abord la
            transcription, puis ouvre ChatGPT et colle-la dans le chat.
          </p>
        </div>

        {/* Étape 1 — Copier */}
        <div
          style={{
            padding: "0 28px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: 0,
            }}
          >
            Étape 1
          </p>
          <button
            type="button"
            onClick={handleCopy}
            disabled={copyState === "loading"}
            data-fb-label="Bouton Étape 1 Copier · Modale guide"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              width: "100%",
              padding: "11px 14px",
              background:
                copyState === "copied"
                  ? "rgba(34,197,94,0.08)"
                  : "var(--color-surface-raised)",
              border: `1px solid ${
                copyState === "copied"
                  ? "rgba(34,197,94,0.3)"
                  : "var(--color-border-default)"
              }`,
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 600,
              color:
                copyState === "copied" ? "#16a34a" : "var(--color-text-primary)",
              cursor: copyState === "loading" ? "wait" : "pointer",
              transition:
                "background 180ms ease, border-color 180ms ease, color 180ms ease",
            }}
            className={
              copyState === "copied"
                ? ""
                : "hover:bg-[rgba(0,0,0,0.03)] hover:border-[rgba(0,0,0,0.12)]"
            }
          >
            {copyState === "copied" ? (
              <Check size={15} style={{ flexShrink: 0 }} />
            ) : (
              <Copy size={15} style={{ flexShrink: 0 }} />
            )}
            {copyState === "loading"
              ? "Copie en cours…"
              : copyState === "copied"
                ? "Transcription copiée ✓"
                : copyState === "error"
                  ? "Erreur, réessaie"
                  : "Copier la transcription"}
          </button>
        </div>

        {/* Étape 2 — Ouvrir ChatGPT */}
        <div
          style={{
            padding: "0 28px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: step2Disabled
                ? "var(--color-text-muted)"
                : "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: 0,
              opacity: step2Disabled ? 0.5 : 1,
            }}
          >
            Étape 2
          </p>
          <a
            href={step2Disabled ? undefined : chatgptUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-fb-label="Bouton Étape 2 Ouvrir ChatGPT · Modale guide"
            onClick={(e) => {
              if (step2Disabled) {
                e.preventDefault();
                return;
              }
              // Fermeture après ouverture pour laisser l'user revenir
              // proprement sur /coaching après.
              window.setTimeout(handleClose, 250);
            }}
            aria-disabled={step2Disabled}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              width: "100%",
              padding: "11px 14px",
              background: step2Disabled
                ? "var(--color-surface-raised)"
                : "#000",
              border: `1px solid ${
                step2Disabled ? "var(--color-border-default)" : "#000"
              }`,
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 600,
              color: step2Disabled
                ? "var(--color-text-muted)"
                : "#fff",
              textDecoration: "none",
              cursor: step2Disabled ? "not-allowed" : "pointer",
              opacity: step2Disabled ? 0.55 : 1,
              transition: "background 180ms ease, opacity 180ms ease",
            }}
          >
            <ExternalLink size={15} style={{ flexShrink: 0 }} />
            Ouvrir ChatGPT et coller (Cmd+V)
          </a>
          {step2Disabled && (
            <p
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                margin: 0,
                fontStyle: "italic",
              }}
            >
              Copie la transcription d&apos;abord pour activer cette étape.
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 28px",
            borderTop: "1px solid var(--color-border-default)",
            background: "var(--color-surface-raised)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
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
