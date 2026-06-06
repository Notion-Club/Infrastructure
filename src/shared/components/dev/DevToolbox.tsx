"use client";

// Toolbox de la barre de navigation — pattern réutilisable par toutes les pages.
//
// Le dropdown agrège deux zones :
//   • EN HAUT  — section « retours » globale (icônes feedback + tickets), la
//     même sur toutes les pages. Enregistrée par le FeedbackWidget via
//     `useRegisterFeedbackTools`.
//   • EN BAS   — panneau d'état dev SPÉCIFIQUE à la page courante. Enregistré
//     par la page via `useRegisterDevTools` (absent → section non affichée).
//
// Le bouton clé à molette s'affiche dès qu'au moins une des deux zones existe.
// Les panneaux sont passés en ReactNode : leurs contrôles vivent dans l'arbre
// React de leur émetteur, donc pilotent directement son état.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Wrench } from "lucide-react";

interface DevToolboxSetApi {
  setPanel: (node: ReactNode | null) => void;
  setFeedback: (node: ReactNode | null) => void;
  requestClose: () => void;
}

interface DevToolboxState {
  panel: ReactNode | null;
  feedback: ReactNode | null;
  closeNonce: number;
}

// « set » stable (consommé par les émetteurs sans re-render) vs « state »
// (consommé par les boutons de la toolbar).
const SetContext = createContext<DevToolboxSetApi | null>(null);
const StateContext = createContext<DevToolboxState>({
  panel: null,
  feedback: null,
  closeNonce: 0,
});

export function DevToolboxProvider({ children }: { children: ReactNode }) {
  const [panel, setPanelState] = useState<ReactNode | null>(null);
  const [feedback, setFeedbackState] = useState<ReactNode | null>(null);
  const [closeNonce, setCloseNonce] = useState(0);

  const setPanel = useCallback((node: ReactNode | null) => setPanelState(node), []);
  const setFeedback = useCallback(
    (node: ReactNode | null) => setFeedbackState(node),
    [],
  );
  const requestClose = useCallback(() => setCloseNonce((n) => n + 1), []);

  const api = useMemo<DevToolboxSetApi>(
    () => ({ setPanel, setFeedback, requestClose }),
    [setPanel, setFeedback, requestClose],
  );
  const state = useMemo<DevToolboxState>(
    () => ({ panel, feedback, closeNonce }),
    [panel, feedback, closeNonce],
  );

  return (
    <SetContext.Provider value={api}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </SetContext.Provider>
  );
}

/** Enregistre le panneau d'état dev de la page courante (zone du bas). */
export function useRegisterDevTools(node: ReactNode) {
  const api = useContext(SetContext);
  useEffect(() => {
    api?.setPanel(node);
  }, [api, node]);
  useEffect(() => {
    return () => api?.setPanel(null);
  }, [api]);
}

/** Enregistre la section « retours » globale (zone du haut). */
export function useRegisterFeedbackTools(node: ReactNode) {
  const api = useContext(SetContext);
  useEffect(() => {
    api?.setFeedback(node);
  }, [api, node]);
  useEffect(() => {
    return () => api?.setFeedback(null);
  }, [api]);
}

/** Demande la fermeture du dropdown (ex. avant d'ouvrir la sélection/le form). */
export function useDevToolboxClose() {
  const api = useContext(SetContext);
  return api?.requestClose ?? (() => {});
}

// ── Bouton + dropdown ──────────────────────────────────────────────────────

type Phase = "closed" | "open" | "closing";
const CLOSE_DUR = 150; // aligné sur --dropdown-close-dur

interface DevToolboxButtonProps {
  size?: number;
  floating?: boolean;
}

export function DevToolboxButton({
  size = 40,
  floating = false,
}: DevToolboxButtonProps) {
  const { panel, feedback, closeNonce } = useContext(StateContext);
  const [phase, setPhase] = useState<Phase>("closed");
  const [entered, setEntered] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const closeMenu = useCallback(() => {
    setEntered(false);
    setPhase("closing");
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPhase("closed"), CLOSE_DUR);
  }, []);

  function openMenu() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setPhase("open");
    setEntered(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
  }

  function toggle() {
    if (phase === "open") closeMenu();
    else openMenu();
  }

  // Fermeture demandée par un panneau (ex. clic « retour sur un élément »).
  const prevNonce = useRef(closeNonce);
  useEffect(() => {
    if (closeNonce === prevNonce.current) return;
    prevNonce.current = closeNonce;
    if (phase === "closed") return;
    // Défère le setState hors du corps synchrone de l'effet.
    const id = requestAnimationFrame(() => closeMenu());
    return () => cancelAnimationFrame(id);
  }, [closeNonce, phase, closeMenu]);

  useEffect(() => {
    if (phase === "closed") return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [phase, closeMenu]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  // Rien à afficher pour cette page → pas de bouton.
  if (!feedback && !panel) return null;

  const ddClass = `t-dropdown nc-dropdown-panel${
    phase === "open" && entered ? " is-open" : ""
  }${phase === "closing" ? " is-closing" : ""}`;

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label="Outils développeur"
        aria-expanded={phase === "open"}
        onClick={toggle}
        data-fb-label="Bouton Outils dev · Barre de navigation"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "none",
          background:
            "linear-gradient(rgba(224,98,90,0.14), rgba(224,98,90,0.14)), var(--color-surface-card)",
          color: "var(--color-brand)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: floating
            ? "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)"
            : undefined,
          transition: "filter 150ms ease",
        }}
        className="hover:brightness-95"
      >
        <Wrench size={size >= 40 ? 18 : 16} />
      </button>

      {phase !== "closed" && (
        <div
          role="menu"
          data-origin="top-right"
          data-fb-label="Panneau outils dev · Barre de navigation"
          className={ddClass}
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 320,
            maxWidth: "calc(100vw - 24px)",
            borderRadius: 16,
            overflow: "hidden",
            zIndex: 70,
            padding: 10,
          }}
        >
          {/* Zone haute — retours (globale) */}
          {feedback}

          {/* Séparateur entre retours et état de page */}
          {feedback && panel && (
            <div
              aria-hidden
              style={{
                height: 1,
                background: "var(--color-border-default)",
                margin: "10px 2px",
              }}
            />
          )}

          {/* Zone basse — état dev de la page */}
          {panel}
        </div>
      )}
    </div>
  );
}
