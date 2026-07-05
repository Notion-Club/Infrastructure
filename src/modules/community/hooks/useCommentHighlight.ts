"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Deep-link `?comment=<id>` : quand `isTarget` passe à vrai, l'élément
 * référencé se scrolle au centre et se surligne brièvement (anneau brand
 * ~2 s). L'anneau est posé en `outline` (pas de layout shift) et le scroll
 * respecte `prefers-reduced-motion`. `scrollMarginTop` (posé par l'appelant)
 * compense le chrome fixe en haut de page.
 */
export function useCommentHighlight<T extends HTMLElement>(isTarget: boolean) {
  const ref = useRef<T>(null);
  const [ring, setRing] = useState(false);

  useEffect(() => {
    if (!isTarget) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // rAF : laisse les réponses éventuellement repliées finir de monter avant
    // de mesurer la position pour le scroll. On y déclenche aussi le ring (hors
    // corps synchrone de l'effet) pour ne pas cascader les renders.
    const raf = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      setRing(true);
    });
    const t = setTimeout(() => setRing(false), 2000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [isTarget]);

  return { ref, ring };
}
