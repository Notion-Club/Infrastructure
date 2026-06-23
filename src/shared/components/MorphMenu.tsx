"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * Dropdown « morph » câblé sur la transition `.t-morph` de transitions-dev
 * (cf. `globals.css` + `.agents/skills/transitions-dev/05-menu-dropdown.md`).
 *
 * Le déclencheur et le panneau vivent dans UN conteneur (.t-morph) qui grandit
 * physiquement de la taille du bouton fermé jusqu'à la taille du panneau ouvert,
 * pendant que l'icône se fond en sortant et le contenu se fond en entrant.
 *
 * - Dimensions FERMÉES : mesurées sur le déclencheur (gère pastille icône ET
 *   pilule texte de largeur variable) → posées en `--morph-closed-w/-h`.
 * - Dimensions OUVERTES : `openWidth` / `openHeight` → `--morph-open-w/-h`.
 * - Le panneau n'est monté que pendant `open`/`closing` (a11y + perfs) ; il est
 *   présent dès le début de la croissance pour être révélé, et démonté une fois
 *   la durée `--morph-close-dur` écoulée. Guard `prefers-reduced-motion` géré en
 *   CSS par le snippet.
 */

type MorphOrigin = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type MorphPhase = "closed" | "open" | "closing";

function readCloseDuration(): number {
  if (typeof window === "undefined") return 240;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--morph-close-dur",
  );
  return parseFloat(raw) || 240;
}

interface MorphMenuProps {
  /** Coin d'où part la croissance (= position du déclencheur). */
  origin?: MorphOrigin;
  /** Largeur / hauteur du panneau ouvert (px). */
  openWidth: number;
  openHeight: number;
  /** Rayon du bouton fermé (px ou keyword). Défaut : pastille ronde. */
  closedRadius?: number | string;
  /** Contenu du déclencheur — reçoit l'état ouvert pour piloter un chevron, etc. */
  triggerContent: ReactNode | ((open: boolean) => ReactNode);
  triggerStyle?: CSSProperties;
  triggerClassName?: string;
  ariaLabel?: string;
  /** `data-fb-label` du panneau (widget feedback admin). */
  triggerFbLabel?: string;
  panelFbLabel?: string;
  panelRole?: "menu" | "listbox" | "dialog";
  /** Style appliqué à l'ancre en flux (ex. flex-shrink). */
  anchorStyle?: CSSProperties;
  /** Contenu du panneau — reçoit `close` pour se refermer (clic item, nav, …). */
  children: ReactNode | ((close: () => void) => ReactNode);
}

export function MorphMenu({
  origin = "top-right",
  openWidth,
  openHeight,
  closedRadius = "9999px",
  triggerContent,
  triggerStyle,
  triggerClassName,
  ariaLabel,
  triggerFbLabel,
  panelFbLabel,
  panelRole = "menu",
  anchorStyle,
  children,
}: MorphMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [phase, setPhase] = useState<MorphPhase>("closed");
  const [closed, setClosed] = useState<{ w: number; h: number } | null>(null);

  const open = phase === "open";
  const mounted = phase !== "closed";

  // Pas d'effet de bord dans les updaters (double-invoqués en StrictMode) :
  // ils ne font que basculer la phase. Le démontage différé est géré par
  // l'unique effet ci-dessous, calé sur --morph-close-dur.
  const close = useCallback(() => {
    setPhase((prev) => (prev === "open" ? "closing" : prev));
  }, []);

  const toggle = useCallback(() => {
    setPhase((prev) => (prev === "open" ? "closing" : "open"));
  }, []);

  // closing → closed (démontage du panneau) une fois la fermeture animée.
  // Si on rouvre pendant la fermeture, le changement de phase nettoie le timer.
  useEffect(() => {
    if (phase !== "closing") return;
    const t = setTimeout(() => setPhase("closed"), readCloseDuration());
    return () => clearTimeout(t);
  }, [phase]);

  // Mesure de la taille fermée (déclencheur). ResizeObserver pour suivre les
  // changements de libellé (pilule fil d'ariane, compteur de filtres, …).
  useLayoutEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && h > 0) setClosed({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Click-outside + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const anchorVars: CSSProperties = {
    ...(closed ? { ["--morph-closed-w" as string]: `${closed.w}px`, ["--morph-closed-h" as string]: `${closed.h}px` } : {}),
    ...anchorStyle,
  };

  const morphVars: CSSProperties = {
    ["--morph-open-w" as string]: `${openWidth}px`,
    ["--morph-open-h" as string]: `${openHeight}px`,
    ["--morph-r-closed" as string]:
      typeof closedRadius === "number" ? `${closedRadius}px` : closedRadius,
    ...(closed ? { ["--morph-closed-w" as string]: `${closed.w}px`, ["--morph-closed-h" as string]: `${closed.h}px` } : {}),
  };

  return (
    <div ref={rootRef} className="t-morph-anchor" data-origin={origin} style={anchorVars}>
      {/* Boîte de clip qui morphe — contient uniquement le panneau (clippé). */}
      <div className="t-morph" data-open={open ? "true" : "false"} data-origin={origin} style={morphVars}>
        {mounted && (
          <div className="t-morph-panel" role={panelRole} data-fb-label={panelFbLabel}>
            {typeof children === "function" ? children(close) : children}
          </div>
        )}
      </div>

      {/* Déclencheur — frère de .t-morph (hors clip), au-dessus. */}
      <button
        ref={triggerRef}
        type="button"
        className={`t-morph-trigger${triggerClassName ? ` ${triggerClassName}` : ""}`}
        style={triggerStyle}
        aria-haspopup={panelRole === "dialog" ? "dialog" : "menu"}
        aria-expanded={open}
        aria-label={ariaLabel}
        data-fb-label={triggerFbLabel}
        onClick={toggle}
      >
        {typeof triggerContent === "function" ? triggerContent(open) : triggerContent}
      </button>
    </div>
  );
}
