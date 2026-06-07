"use client";

// Grille des appels à venir avec sortie animée : quand un appel disparaît de la
// liste (ex. annulé via le pop-up de replanification), on le garde monté le
// temps de jouer l'animation de fermeture (`t-modal.is-closing`) avant de le
// retirer du DOM — plus de disparition brutale.

import { useEffect, useRef, useState } from "react";
import { CallTile } from "@/shared/components/coaching/CallTile";
import type { CallCardData } from "@/shared/lib/mock/coaching";

// > --modal-close-dur (150ms) — marge pour laisser l'anim se terminer.
const EXIT_DUR = 180;

interface AnimatedUpcomingGridProps {
  calls: CallCardData[];
  onReschedule?: (url: string) => void;
}

export function AnimatedUpcomingGrid({
  calls,
  onReschedule,
}: AnimatedUpcomingGridProps) {
  const [rendered, setRendered] = useState<CallCardData[]>(calls);
  const [exiting, setExiting] = useState<Record<string, true>>({});
  const renderedRef = useRef<CallCardData[]>(calls);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const callsById = new Map(calls.map((c) => [c.id, c]));
    const prev = renderedRef.current;
    const prevIds = new Set(prev.map((c) => c.id));

    // Items existants (données à jour, ex. date replanifiée) conservés à leur
    // place ; nouveaux ajoutés à la fin ; les sortants restent (marqués exiting).
    const merged = prev.map((c) => callsById.get(c.id) ?? c);
    calls.forEach((c) => {
      if (!prevIds.has(c.id)) merged.push(c);
    });
    const exitingNow = prev.filter((c) => !callsById.has(c.id));

    // setState déféré (hors corps synchrone de l'effet).
    const raf = requestAnimationFrame(() => {
      renderedRef.current = merged;
      setRendered(merged);

      if (exitingNow.length) {
        setExiting((e) => {
          const n = { ...e };
          exitingNow.forEach((c) => (n[c.id] = true));
          return n;
        });
        exitingNow.forEach((c) => {
          const t = window.setTimeout(() => {
            renderedRef.current = renderedRef.current.filter(
              (x) => x.id !== c.id,
            );
            setRendered((r) => r.filter((x) => x.id !== c.id));
            setExiting((e) => {
              const n = { ...e };
              delete n[c.id];
              return n;
            });
          }, EXIT_DUR);
          timersRef.current.push(t);
        });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [calls]);

  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      data-fb-label="Grille appels à venir · Coaching"
    >
      {rendered.map((call) => (
        <div
          key={call.id}
          className={`t-modal ${exiting[call.id] ? "is-closing" : "is-open"}`}
        >
          <CallTile call={call} variant="upcoming" onReschedule={onReschedule} />
        </div>
      ))}
    </div>
  );
}
