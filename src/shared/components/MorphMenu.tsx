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
  /**
   * Largeur / hauteur du panneau ouvert (px). Si omis, la dimension est
   * MESURÉE sur le contenu naturel du panneau (max-content) → le morph colle
   * exactement aux dimensions du pop-up d'origine, sans rognage ni espace vide.
   * On fixe typiquement la largeur (design) et on laisse la hauteur se mesurer.
   */
  openWidth?: number;
  openHeight?: number;
  /**
   * Rayon du bouton fermé (px ou keyword). Si omis : moitié de la taille
   * MESURÉE du déclencheur → cercle/pilule parfaitement ronde exprimée en px
   * RÉEL, proche du rayon ouvert. Crucial : ne JAMAIS partir d'un 9999px, sinon
   * l'ease rebondissante du border-radius dépasse sa cible jusqu'à 0 → coins
   * carrés visibles en milieu d'animation (la source part de 40px, pas 9999).
   */
  closedRadius?: number | string;
  /** z-index posé sur l'ancre — le morph doit flotter au-dessus du contenu. */
  zIndex?: number;
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
  closedRadius,
  zIndex,
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
  const panelRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<MorphPhase>("closed");
  const [closed, setClosed] = useState<{ w: number; h: number } | null>(null);
  // Taille naturelle mesurée du panneau, pour les axes laissés en auto.
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);

  const open = phase === "open";
  const mounted = phase !== "closed";
  const autoW = openWidth == null;
  const autoH = openHeight == null;

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

  // Mesure de la taille OUVERTE naturelle, pour les axes laissés en auto.
  // L'axe auto rend le panneau en `max-content` → offsetWidth/Height = taille
  // réelle du contenu, qu'on reporte sur la boîte (--morph-open-w/-h). RO pour
  // suivre les changements de contenu (accordéon des filtres, etc.).
  useLayoutEffect(() => {
    if (!mounted || (!autoW && !autoH)) return;
    const el = panelRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && h > 0) setMeasured({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted, autoW, autoH]);

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

  // Dimensions ouvertes de la boîte : valeur fixe si fournie, sinon mesurée.
  const resolvedW = openWidth != null ? openWidth : measured?.w;
  const resolvedH = openHeight != null ? openHeight : measured?.h;

  const closedVars = closed
    ? { ["--morph-closed-w" as string]: `${closed.w}px`, ["--morph-closed-h" as string]: `${closed.h}px` }
    : {};

  const anchorVars: CSSProperties = {
    ...(zIndex != null ? { zIndex } : {}),
    ...closedVars,
    ...anchorStyle,
  };

  // Rayon fermé : explicite si fourni, sinon moitié de la taille mesurée du
  // déclencheur (cercle/pilule parfaitement rond, en px RÉEL proche du rayon
  // ouvert → l'overshoot de l'ease rebondissante reste positif, jamais carré).
  const rClosed =
    closedRadius != null
      ? typeof closedRadius === "number"
        ? `${closedRadius}px`
        : closedRadius
      : closed
        ? `${Math.min(closed.w, closed.h) / 2}px`
        : "9999px";

  const morphVars: CSSProperties = {
    ...(resolvedW != null ? { ["--morph-open-w" as string]: `${resolvedW}px` } : {}),
    ...(resolvedH != null ? { ["--morph-open-h" as string]: `${resolvedH}px` } : {}),
    ["--morph-r-closed" as string]: rClosed,
    ...closedVars,
  };

  // L'axe auto rend le panneau en max-content (taille naturelle à mesurer) ;
  // l'axe fixe suit la variable CSS --morph-open-*.
  const panelStyle: CSSProperties = {
    ...(autoW ? { width: "max-content" } : {}),
    ...(autoH ? { height: "max-content" } : {}),
  };

  return (
    <div ref={rootRef} className="t-morph-anchor" data-origin={origin} style={anchorVars}>
      {/* Boîte de clip qui morphe — contient uniquement le panneau (clippé). */}
      <div className="t-morph" data-open={open ? "true" : "false"} data-origin={origin} style={morphVars}>
        {mounted && (
          <div
            ref={panelRef}
            className="t-morph-panel"
            role={panelRole}
            data-fb-label={panelFbLabel}
            style={panelStyle}
          >
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
