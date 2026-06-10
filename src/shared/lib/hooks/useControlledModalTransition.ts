"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Variante de `useModalTransition` pour les modales **pilotées par une prop
 * `isOpen`** (le parent garde le composant monté et bascule `isOpen`, le
 * composant rend `null` quand fermé). Câble la transition `t-modal` de
 * transitions-dev (cf. `.agents/skills/transitions-dev/06-modal.md`).
 *
 * Le composant ne peut plus court-circuiter sur `if (!isOpen) return null`,
 * sinon la sortie n'a pas le temps de jouer. On expose `shouldRender` qui
 * reste vrai pendant l'animation de fermeture :
 *   isOpen=true  → pre-open (état de repos) → open (is-open)
 *   isOpen=false → closing (is-closing) → closed (shouldRender devient faux)
 *
 * Les changements de phase sont programmés via `requestAnimationFrame` /
 * microtask plutôt qu'appelés en synchrone dans le corps de l'effet (pattern
 * du repo pour `react-hooks/set-state-in-effect` — cf. CoachingPageClient).
 * La durée de sortie suit `--modal-close-dur`. Le guard `prefers-reduced-motion`
 * est géré côté CSS par le snippet.
 */
type ModalPhase = "closed" | "pre-open" | "open" | "closing";

function readCloseDuration(): number {
  if (typeof window === "undefined") return 150;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--modal-close-dur",
  );
  return parseFloat(raw) || 150;
}

export function useControlledModalTransition(isOpen: boolean) {
  const [phase, setPhase] = useState<ModalPhase>(isOpen ? "pre-open" : "closed");
  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réagit aux changements de `isOpen` : ouvre (→ pre-open) ou ferme (→ closing
  // puis closed). setState déféré hors du corps synchrone de l'effet.
  useEffect(() => {
    let cancelled = false;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }

    if (isOpen) {
      raf.current = requestAnimationFrame(() => {
        if (!cancelled) setPhase((prev) => (prev === "open" ? "open" : "pre-open"));
      });
    } else {
      Promise.resolve().then(() => {
        if (cancelled) return;
        setPhase((prev) => (prev === "closed" ? "closed" : "closing"));
      });
      timer.current = setTimeout(() => {
        if (!cancelled) setPhase("closed");
      }, readCloseDuration());
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Promotion pre-open → open au frame suivant pour amorcer la transition d'entrée.
  useEffect(() => {
    if (phase !== "pre-open") return;
    raf.current = requestAnimationFrame(() => setPhase("open"));
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [phase]);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const shouldRender = phase !== "closed";
  const stateClass = phase === "open" ? "is-open" : phase === "closing" ? "is-closing" : "";
  const overlayOpen = phase === "open";

  return { shouldRender, stateClass, overlayOpen };
}
