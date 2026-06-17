"use client";

import { usePathname } from "next/navigation";
import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactNode,
} from "react";

// ============================================================================
// ContentEnter (#130) — wrapper d'apparition de contenu unifié.
//
// Reprend l'animation « premium » de /coaching (keyframe `nc-mode-in` :
// opacity 0→1 + translateY(8px→0), 250ms cubic-bezier(0.22,1,0.36,1)) et la
// rend réutilisable partout : contenu principal d'une page, sections, et
// overlays / modales.
//
// - `key` lié au pathname : l'animation se rejoue à chaque changement de page
//   (effet « swipe / transition » cohérent d'un écran à l'autre).
// - `stagger` : décale l'apparition des enfants directs (var CSS `--nc-enter-i`).
// - Respecte `prefers-reduced-motion` (géré dans globals.css).
// - Volontairement opacity + translate légers (pas de blur massif) → fluide
//   sur mobile.
// ============================================================================

type ContentEnterProps = {
  children: ReactNode;
  /** Décale l'apparition des enfants directs (effet cascade). */
  stagger?: boolean;
  /** Rejoue l'animation à chaque changement de route (défaut: true). */
  replayOnRouteChange?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function ContentEnter({
  children,
  stagger = false,
  replayOnRouteChange = true,
  className,
  style,
}: ContentEnterProps) {
  const pathname = usePathname();

  if (stagger) {
    return (
      <div
        key={replayOnRouteChange ? pathname : undefined}
        className={className}
        style={style}
      >
        {Children.map(children, (child, i) => {
          if (!isValidElement<{ className?: string; style?: CSSProperties }>(child))
            return child;
          const childClassName = [child.props.className, "nc-content-enter"]
            .filter(Boolean)
            .join(" ");
          return cloneElement(child, {
            className: childClassName,
            style: {
              ...(child.props.style ?? {}),
              ["--nc-enter-i" as string]: i,
            },
          });
        })}
      </div>
    );
  }

  return (
    <div
      key={replayOnRouteChange ? pathname : undefined}
      className={["nc-content-enter", className].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </div>
  );
}
