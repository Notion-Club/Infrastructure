"use client";

import { useEffect, useRef, useState } from "react";
import { MacOSWindowBar } from "@/shared/components/ui/MacOSWindowBar";
import { buildFilloutUrl } from "@/shared/lib/fillout/url";

interface FilloutModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Appelé une fois le formulaire soumis (page de remerciement Fillout
  // détectée) — sert à rafraîchir la liste des appels à venir.
  onSubmitted?: () => void;
  baseUrl: string;
  id: string | null;
  mail: string | null;
  prenom: string | null;
  nom: string | null;
}

// Hauteur de repli tant que Fillout n'a pas annoncé sa taille.
const FALLBACK_HEIGHT = 560;
// Délai avant fermeture auto après la confirmation (on laisse voir la page de
// remerciement native Fillout pendant ce temps).
const AUTO_CLOSE_MS = 2500;
// TEMP — logue les postMessages reçus pour identifier le format exact de
// l'event de soumission Fillout (à repasser à false une fois calé).
const FILLOUT_DEBUG = true;

// Recherche en profondeur une valeur de hauteur dans le payload (clé contenant
// « height »), quel que soit le niveau d'imbrication — le format Fillout varie
// selon les versions de l'embed.
function extractHeight(data: unknown): number | null {
  let best: number | null = null;
  const visit = (node: unknown, keyHint: string, depth: number) => {
    if (depth > 4 || node == null) return;
    const isHeightKey = /height/i.test(keyHint);
    if (typeof node === "number") {
      if (isHeightKey && Number.isFinite(node) && node > 0) {
        best = best == null ? node : Math.max(best, node);
      }
      return;
    }
    if (typeof node === "string") {
      if (isHeightKey && /^\d+(\.\d+)?$/.test(node)) {
        const n = parseFloat(node);
        if (n > 0) best = best == null ? n : Math.max(best, n);
      }
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        visit(v, k, depth + 1);
      }
    }
  };
  visit(data, "", 0);
  return best;
}

// Détection défensive de l'événement « formulaire soumis » émis par Fillout.
// Le format exact varie selon les versions de l'embed : on sérialise tout le
// payload (string ou objet) et on cherche un mot-clé de soumission, en
// écartant les messages de cycle de vie (height, resize, step…) sauf s'ils
// contiennent aussi un mot-clé de soumission.
function isSubmissionMessage(raw: unknown): boolean {
  let s: string | null = null;
  if (typeof raw === "string") s = raw;
  else if (raw && typeof raw === "object") {
    try {
      s = JSON.stringify(raw);
    } catch {
      s = null;
    }
  }
  if (!s) return false;

  const hasSubmit = /submit|thank\s*-?\s*you|thankyou|finished?|confirmation|success/i.test(s);
  if (!hasSubmit) return false;

  // Si c'est clairement un message de mesure/cycle de vie sans signal de
  // soumission, on ignore (déjà filtré par hasSubmit, mais garde-fou).
  const isLifecycleOnly =
    /height|resize|scroll|heartbeat|"init"|"ready"|"load"/i.test(s) && !hasSubmit;
  return !isLifecycleOnly;
}

export function FilloutModal({
  isOpen,
  onClose,
  onSubmitted,
  baseUrl,
  id,
  mail,
  prenom,
  nom,
}: FilloutModalProps) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const submittedRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Écoute les messages de l'iframe Fillout : redimensionnement + détection de
  // la soumission (page de remerciement) → confirmation puis fermeture auto et
  // rafraîchissement des appels à venir. Reset à l'ouverture / changement de
  // formulaire (microtask pour éviter le setState synchrone dans l'effet).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    submittedRef.current = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setContentHeight(null);
    });

    function onMessage(e: MessageEvent) {
      // TEMP debug — capture le format réel des messages Fillout.
      if (FILLOUT_DEBUG) {
        console.info("[FilloutModal] postMessage", e.origin, e.data);
      }
      if (
        typeof e.origin === "string" &&
        !e.origin.toLowerCase().includes("fillout")
      ) {
        return;
      }
      let data: unknown = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          // Message string non-JSON — peut quand même signaler une soumission.
          if (!submittedRef.current && isSubmissionMessage(e.data)) {
            handleSubmitted();
          }
          return;
        }
      }

      const h = extractHeight(data);
      if (h) setContentHeight(Math.ceil(h));

      if (!submittedRef.current && isSubmissionMessage(data)) {
        handleSubmitted();
      }
    }

    function handleSubmitted() {
      submittedRef.current = true;
      // On laisse la page de remerciement native de Fillout visible, puis on
      // ferme automatiquement après le délai.
      onSubmitted?.();
      closeTimerRef.current = window.setTimeout(() => {
        onClose();
      }, AUTO_CLOSE_MS);
    }

    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isOpen, baseUrl, id, mail, prenom, nom, onClose, onSubmitted]);

  if (!isOpen) return null;

  const iframeUrl = buildFilloutUrl(baseUrl, { id, mail, prenom, nom });

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={handleOverlayClick}
      data-fb-label="Modale réservation · Coaching"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: "16px",
      }}
    >
      {/* Modal window — la hauteur suit le contenu Fillout, plafonnée à 90vh */}
      <div
        data-fb-label="Fenêtre formulaire · Modale réservation"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 700,
          maxHeight: "90vh",
          background: "var(--color-surface-card)",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "nc-modal-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <MacOSWindowBar onClose={onClose} />

        {/* Conteneur scrollable seulement si le formulaire dépasse 90vh —
            sinon la fenêtre épouse exactement la hauteur de Fillout. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <iframe
            src={iframeUrl}
            frameBorder={0}
            style={{
              display: "block",
              width: "100%",
              height: contentHeight ?? FALLBACK_HEIGHT,
              border: "none",
              transition: "height 240ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            title="Formulaire de réservation"
          />
        </div>
      </div>
    </div>
  );
}
