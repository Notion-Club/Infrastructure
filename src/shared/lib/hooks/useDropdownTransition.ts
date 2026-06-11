"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pilote le cycle d'ouverture/fermeture d'un dropdown câblé sur la transition
 * `t-dropdown` de transitions-dev (cf. `.agents/skills/transitions-dev/05-menu-dropdown.md`).
 *
 * Le snippet exige que l'élément reste **monté** le temps que l'animation
 * joue : on ne fait donc pas de `{open && …}` brut. Cycle :
 *   closed → pre-open (monté, état de repos) → open (is-open) → closing (is-closing) → closed
 * Le passage `pre-open → open` est promu au frame suivant via `requestAnimationFrame`
 * pour que la transition d'entrée (scale-up + fade) parte bien de l'état de
 * repos au lieu de sauter directement à `is-open`. Le `setTimeout` de fermeture
 * est calé sur `--dropdown-close-dur` lu dans le `:root` global, donc la durée
 * JS reste en phase avec la durée CSS. Le guard `prefers-reduced-motion` est
 * géré côté CSS par le snippet.
 */
type DropdownPhase = "closed" | "pre-open" | "open" | "closing";

function readCloseDuration(): number {
  if (typeof window === "undefined") return 150;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--dropdown-close-dur",
  );
  return parseFloat(raw) || 150;
}

export function useDropdownTransition() {
  const [phase, setPhase] = useState<DropdownPhase>("closed");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef<number | null>(null);

  const clearTimers = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  };

  const open = useCallback(() => {
    clearTimers();
    setPhase("pre-open");
  }, []);

  const close = useCallback(() => {
    setPhase((prev) => {
      if (prev === "closed" || prev === "closing") return prev;
      clearTimers();
      closeTimer.current = setTimeout(() => {
        setPhase("closed");
        closeTimer.current = null;
      }, readCloseDuration());
      return "closing";
    });
  }, []);

  const toggle = useCallback(() => {
    setPhase((prev) => {
      clearTimers();
      if (prev === "open" || prev === "pre-open") {
        closeTimer.current = setTimeout(() => {
          setPhase("closed");
          closeTimer.current = null;
        }, readCloseDuration());
        return "closing";
      }
      return "pre-open";
    });
  }, []);

  // Promotion pre-open → open au frame suivant pour amorcer la transition.
  useEffect(() => {
    if (phase !== "pre-open") return;
    raf.current = requestAnimationFrame(() => setPhase("open"));
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [phase]);

  useEffect(() => clearTimers, []);

  const isMounted = phase !== "closed";
  const isOpen = phase === "open" || phase === "pre-open";
  const stateClass = phase === "open" ? "is-open" : phase === "closing" ? "is-closing" : "";

  return { phase, isOpen, isMounted, stateClass, open, close, toggle };
}
