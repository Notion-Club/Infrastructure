"use client";

// Toolbox « état dev » de la barre de navigation — pattern réutilisable par
// toutes les pages.
//
// Principe :
//   • Chaque page enregistre SON panneau d'outils dev via `useRegisterDevTools`
//     (un seul panneau actif à la fois — une page à la fois).
//   • `DevToolboxButton` (rendu dans la Topbar + les actions mobiles) lit ce
//     panneau et l'affiche dans un dropdown. S'il n'y a pas de panneau pour la
//     page courante, le bouton ne s'affiche pas (ex. /ressources sans options).
//
// Le panneau est passé tel quel (ReactNode) : ses toggles vivent dans l'arbre
// React de la page, donc ils pilotent directement l'état de la page.

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
  set: (node: ReactNode | null) => void;
}

// Deux contextes séparés : le « set » est stable (les pages le consomment sans
// re-render quand le panneau change) ; le « panel » change et ne re-rend que
// les boutons de la toolbar.
const SetContext = createContext<DevToolboxSetApi | null>(null);
const PanelContext = createContext<ReactNode | null>(null);

export function DevToolboxProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<ReactNode | null>(null);
  const set = useCallback((node: ReactNode | null) => setPanel(node), []);
  const api = useMemo<DevToolboxSetApi>(() => ({ set }), [set]);

  return (
    <SetContext.Provider value={api}>
      <PanelContext.Provider value={panel}>{children}</PanelContext.Provider>
    </SetContext.Provider>
  );
}

/**
 * Enregistre le panneau d'outils dev de la page courante. Mémoïse `node` côté
 * appelant (`useMemo`) pour ne pas ré-enregistrer à chaque render.
 */
export function useRegisterDevTools(node: ReactNode) {
  const api = useContext(SetContext);

  // Met à jour le panneau quand `node` change (sans flicker : pas de reset
  // à null entre deux valeurs).
  useEffect(() => {
    api?.set(node);
  }, [api, node]);

  // Nettoie uniquement au démontage de la page.
  useEffect(() => {
    return () => api?.set(null);
  }, [api]);
}

// ── Bouton + dropdown ──────────────────────────────────────────────────────

type Phase = "closed" | "open" | "closing";
const CLOSE_DUR = 150; // doit rester aligné sur --dropdown-close-dur

interface DevToolboxButtonProps {
  size?: number;
  // Ajoute une ombre portée (boutons flottants mobiles).
  floating?: boolean;
}

export function DevToolboxButton({
  size = 40,
  floating = false,
}: DevToolboxButtonProps) {
  const panel = useContext(PanelContext);
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
    // Double rAF : laisse l'état de base (.t-dropdown) peindre avant d'ajouter
    // .is-open → la transition d'entrée joue.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
  }

  function toggle() {
    if (phase === "open") closeMenu();
    else openMenu();
  }

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

  // Pas de panneau pour la page courante → pas de bouton.
  if (!panel) return null;

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
          // Fond pastel rouge opaque (tint brand composé sur la surface).
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
            minWidth: 252,
            borderRadius: 16,
            overflow: "hidden",
            zIndex: 70,
            padding: 10,
          }}
        >
          {panel}
        </div>
      )}
    </div>
  );
}
