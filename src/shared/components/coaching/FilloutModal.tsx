"use client";

import { useEffect, useState } from "react";
import { MacOSWindowBar } from "@/shared/components/ui/MacOSWindowBar";
import { buildFilloutUrl } from "@/shared/lib/fillout/url";

interface FilloutModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseUrl: string;
  id: string | null;
  mail: string | null;
  prenom: string | null;
  nom: string | null;
}

// Hauteur de repli tant que Fillout n'a pas annoncé sa taille.
const FALLBACK_HEIGHT = 560;

// Fillout poste la hauteur de son contenu au parent quand le formulaire est
// embarqué (changement d'étape, contenu plus long…). Le format exact varie
// selon les versions de l'embed : on scanne donc défensivement les clés de
// hauteur les plus courantes plutôt que de coder en dur un seul schéma.
function extractHeight(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const nested = (key: string): unknown =>
    obj[key] && typeof obj[key] === "object"
      ? (obj[key] as Record<string, unknown>).height
      : undefined;
  const candidates: unknown[] = [
    obj.height,
    obj.scrollHeight,
    nested("value"),
    nested("data"),
    nested("payload"),
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
    if (typeof c === "string" && /^\d+(\.\d+)?$/.test(c)) {
      const n = parseFloat(c);
      if (n > 0) return n;
    }
  }
  return null;
}

export function FilloutModal({
  isOpen,
  onClose,
  baseUrl,
  id,
  mail,
  prenom,
  nom,
}: FilloutModalProps) {
  // Hauteur réelle du contenu Fillout (null tant qu'on ne l'a pas reçue).
  const [contentHeight, setContentHeight] = useState<number | null>(null);

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

  // Écoute les messages de redimensionnement émis par l'iframe Fillout et
  // ajuste la hauteur pour que tout le formulaire soit visible sans scroll
  // interne. Reset à l'ouverture / changement de formulaire (microtask pour
  // éviter le setState synchrone dans l'effet).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setContentHeight(null);
    });

    function onMessage(e: MessageEvent) {
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
          return;
        }
      }
      const h = extractHeight(data);
      if (h) setContentHeight(Math.ceil(h));
    }

    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, [isOpen, baseUrl, id, mail, prenom, nom]);

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
