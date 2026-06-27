"use client";

import { useEffect, useState } from "react";

/**
 * Monte / démonte un nœud inline avec une animation de collapse en entrée ET en
 * sortie, calqué sur `useModalTransition` mais pour un repli vertical (et non un
 * scale de modale).
 *
 * Problème résolu : `{open && <Composer />}` démonte le nœud sec dès que `open`
 * repasse à `false` → aucune transition de sortie possible. Ici on garde le nœud
 * monté le temps de la transition : à la fermeture on joue d'abord `is-leaving`
 * (collapse via `.nc-composer-collapse`), puis on démonte une fois la durée CSS
 * écoulée (lue via `getComputedStyle`).
 *
 * L'entrée part de l'état replié (`is-entering`) puis est promue à l'état ouvert
 * au frame suivant via `requestAnimationFrame`, sinon le nœud monterait déjà
 * déplié et la transition d'entrée sauterait (même ressort que `useModalTransition`).
 *
 * On bascule de phase via le pattern React « ajuster l'état au changement de
 * prop pendant le rendu » (cf. https://react.dev/learn/you-might-not-need-an-effect),
 * et non dans un `useEffect` : les effets ne font que des `setState` différés
 * (rAF / setTimeout), pour ne pas déclencher de rendus en cascade.
 *
 * Le guard `prefers-reduced-motion` est géré côté CSS par `.nc-composer-collapse`
 * (transition désactivée → apparition/disparition immédiates, sans bug).
 *
 * @param open  état désiré côté parent
 * @returns `mounted` (le nœud doit-il être dans le DOM), `entering`/`leaving`
 *          (phases de transition) et `stateClass` (`is-entering` | `is-leaving`
 *          | `""`) à concaténer à `.nc-composer-collapse`.
 */
type CollapsePhase = "closed" | "entering" | "open" | "leaving";

function readCollapseDuration(): number {
  if (typeof window === "undefined") return 250;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--nc-composer-collapse-dur",
  );
  return parseFloat(raw) || 250;
}

export function useCollapseTransition(open: boolean) {
  const [phase, setPhase] = useState<CollapsePhase>(open ? "open" : "closed");
  const [prevOpen, setPrevOpen] = useState(open);

  // Ajustement d'état pendant le rendu (pas dans un effet) au changement de `open` :
  // ouverture → on monte en `entering`, fermeture → on joue `leaving` avant démontage.
  if (prevOpen !== open) {
    setPrevOpen(open);
    setPhase(open ? "entering" : "leaving");
  }

  // Promotion entering → open au frame suivant pour amorcer la transition d'entrée.
  useEffect(() => {
    if (phase !== "entering") return;
    const raf = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Démontage différé après le collapse de sortie (durée lue côté CSS).
  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("closed"), readCollapseDuration());
    return () => clearTimeout(timer);
  }, [phase]);

  const stateClass =
    phase === "entering" ? "is-entering" : phase === "leaving" ? "is-leaving" : "";

  return {
    mounted: phase !== "closed",
    entering: phase === "entering",
    leaving: phase === "leaving",
    stateClass,
  };
}
