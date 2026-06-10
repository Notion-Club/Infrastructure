"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pilote l'ouverture/fermeture d'une modale câblée sur la transition `t-modal`
 * de transitions-dev (cf. `.agents/skills/transitions-dev/06-modal.md`).
 *
 * Contrairement au dropdown, une modale est montée/démontée par son parent
 * (`{show && <Modal onClose={…} />}`). Pour que la sortie s'anime, on ne peut
 * pas laisser le parent démonter immédiatement : `requestClose(done)` joue
 * d'abord `is-closing`, puis appelle `done()` (typiquement le `onClose` parent
 * qui démonte) une fois la durée `--modal-close-dur` écoulée.
 *
 * L'entrée part de l'état de repos (`scale(--modal-scale)`, opacité 0) puis est
 * promue à `is-open` au frame suivant via `requestAnimationFrame`, sinon React
 * monterait déjà ouverte et la transition d'entrée sauterait. `overlayOpen`
 * permet de faire fondre le backdrop sur la même cadence. Le guard
 * `prefers-reduced-motion` est géré côté CSS par le snippet.
 */
type ModalPhase = "pre-open" | "open" | "closing";

function readCloseDuration(): number {
  if (typeof window === "undefined") return 150;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--modal-close-dur",
  );
  return parseFloat(raw) || 150;
}

export function useModalTransition() {
  const [phase, setPhase] = useState<ModalPhase>("pre-open");
  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closing = useRef(false);

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

  const requestClose = useCallback((done?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    setPhase("closing");
    timer.current = setTimeout(() => {
      done?.();
    }, readCloseDuration());
  }, []);

  const stateClass = phase === "open" ? "is-open" : phase === "closing" ? "is-closing" : "";
  const overlayOpen = phase === "open";

  return { phase, stateClass, overlayOpen, requestClose };
}
