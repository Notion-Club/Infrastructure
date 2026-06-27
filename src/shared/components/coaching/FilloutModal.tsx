"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MacOSWindowBar } from "@/shared/components/ui/MacOSWindowBar";
import { buildFilloutUrl } from "@/shared/lib/fillout/url";

interface FilloutModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Appelé une fois le formulaire soumis (page de remerciement Fillout
  // détectée) — sert à rafraîchir la liste des appels à venir.
  onSubmitted?: () => void;
  // Pour les liens de replanification / annulation : la confirmation est
  // souvent atteinte par REDIRECTION (l'iframe recharge) plutôt que par un
  // event de soumission. On déclenche alors la fermeture auto sur le 2e `load`
  // de l'iframe (la page de confirmation).
  autoCloseOnNavigate?: boolean;
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
// Logue les postMessages reçus pour identifier le format exact de l'event de
// soumission Fillout. Désactivé en prod (bruit console + données postMessage
// tierces) ; repasser temporairement à true en local pour diagnostiquer.
const FILLOUT_DEBUG = false;

// Recherche une valeur de hauteur dans le payload, quel que soit le format de
// l'embed :
//   1. en priorité, un nombre sous une clé contenant « height » ;
//   2. à défaut, si le message porte un indice de taille (type/clé/texte avec
//      height/resize/size), on prend le plus grand nombre plausible du payload.
function extractHeight(data: unknown): number | null {
  let heightKeyed: number | null = null;
  let sizeHint = false;
  const numbers: number[] = [];

  const visit = (node: unknown, keyHint: string, depth: number) => {
    if (depth > 5 || node == null) return;
    if (typeof node === "number") {
      if (Number.isFinite(node) && node > 0) {
        numbers.push(node);
        if (/height/i.test(keyHint)) {
          heightKeyed = heightKeyed == null ? node : Math.max(heightKeyed, node);
        }
      }
      return;
    }
    if (typeof node === "string") {
      if (/height|resize|size/i.test(keyHint) || /height|resize/i.test(node)) {
        sizeHint = true;
      }
      if (/height/i.test(keyHint) && /^\d+(\.\d+)?$/.test(node)) {
        const n = parseFloat(node);
        if (n > 0) {
          numbers.push(n);
          heightKeyed = heightKeyed == null ? n : Math.max(heightKeyed, n);
        }
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

  if (heightKeyed != null) return heightKeyed;
  if (sizeHint) {
    const plausible = numbers.filter((n) => n >= 120 && n <= 20000);
    if (plausible.length) return Math.max(...plausible);
  }
  return null;
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

  const hasSubmit =
    /submit|thank\s*-?\s*you|thankyou|finished?|confirmation|confirmed|success|booked|scheduled|rescheduled|cancell?ed|annul|meeting\s*(re)?scheduled|rendez[\s-]?vous|r[ée]serv|merci|termin[ée]/i.test(
      s,
    );
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
  autoCloseOnNavigate = false,
  baseUrl,
  id,
  mail,
  prenom,
  nom,
}: FilloutModalProps) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const submittedRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  // Suivi des `load` de l'iframe + instant d'ouverture pour la fermeture sur
  // navigation (réservation par redirection).
  const loadCountRef = useRef(0);
  const openedAtRef = useRef(0);

  // Réinitialise le suivi de navigation à chaque ouverture.
  useEffect(() => {
    if (!isOpen) return;
    loadCountRef.current = 0;
    openedAtRef.current = Date.now();
  }, [isOpen, baseUrl]);

  // Confirmation détectée → laisse voir la page de remerciement native puis
  // ferme automatiquement après le délai. Idempotent (submittedRef).
  const triggerAutoClose = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmitted?.();
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, AUTO_CLOSE_MS);
  }, [onClose, onSubmitted]);

  // Fermeture sur navigation de l'iframe (2e `load` = page de confirmation)
  // pour les liens de replanification atteints par redirection.
  const handleIframeLoad = useCallback(() => {
    loadCountRef.current += 1;
    if (!autoCloseOnNavigate) return;
    if (loadCountRef.current <= 1) return; // 1er load = la page initiale
    if (Date.now() - openedAtRef.current < 1200) return; // ignore double-load initial
    triggerAutoClose();
  }, [autoCloseOnNavigate, triggerAutoClose]);

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
      // Pas de filtre d'origine strict : le pop-up sert aussi des liens de
      // replanification non-Fillout (TidyCal, etc.) qui postent depuis d'autres
      // domaines. On se fie au CONTENU du message (hauteur numérique / mots-clés
      // de soumission) comme garde-fou — la modale n'est ouverte que pendant une
      // réservation active, fenêtre où un message parasite est improbable.
      let data: unknown = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          // Message string non-JSON — peut quand même signaler une soumission.
          if (isSubmissionMessage(e.data)) triggerAutoClose();
          return;
        }
      }

      const h = extractHeight(data);
      if (h) setContentHeight(Math.ceil(h));

      if (isSubmissionMessage(data)) triggerAutoClose();
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
  }, [isOpen, baseUrl, id, mail, prenom, nom, triggerAutoClose]);

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
          maxHeight: "94vh",
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
            onLoad={handleIframeLoad}
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
