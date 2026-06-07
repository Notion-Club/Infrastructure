"use client";

// Texte de chargement animé de la transcription.
//
// Combine deux animations (cf. tokens `.t-text-swap` / `.t-shimmer` dans
// globals.css) :
//   1. Défilement de courtes phrases de storytelling — swap en 3 phases
//      (sortie haut + blur/fade → changement de texte → entrée depuis le bas),
//      piloté ici en impératif (toggle de classes + reflow forcé) pour ne pas
//      que React re-render combatte la transition CSS.
//   2. Band rouge signature qui balaie chaque phrase (shimmer CSS), avec
//      `data-text` maintenu synchro du texte visible.
//
// Respecte `prefers-reduced-motion` : on se contente de permuter le texte
// sans transition ni shimmer.

import { useEffect, useRef } from "react";

interface TranscriptLoadingTextProps {
  host: string;
}

// Durée d'affichage d'une phrase avant le swap suivant (ms).
const HOLD_MS = 1900;
// Doit rester aligné sur --text-swap-dur dans globals.css.
const SWAP_DUR_MS = 150;

export function TranscriptLoadingText({ host }: TranscriptLoadingTextProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const who = host?.trim() ? host.trim() : "ton coach";
    const phrases = [
      "On récupère la transcription",
      `On analyse ce que tu disais à ${who}`,
      "On vérifie la transcription",
      "On remet les échanges en forme",
      "Encore deux secondes…",
    ];

    let index = 0;
    const setText = (text: string) => {
      el.textContent = text;
      el.setAttribute("data-text", text);
    };
    setText(phrases[0]);

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Reduced motion : permutation simple, sans transition ni shimmer.
    if (reduce) {
      const id = window.setInterval(() => {
        index = (index + 1) % phrases.length;
        setText(phrases[index]);
      }, HOLD_MS);
      return () => window.clearInterval(id);
    }

    let swapTimer = 0;
    const tick = () => {
      // Phase 1 — sortie de la phrase courante.
      el.classList.add("is-exit");
      swapTimer = window.setTimeout(() => {
        // Phase 2 — changement de texte + position d'entrée (sans transition).
        index = (index + 1) % phrases.length;
        setText(phrases[index]);
        el.classList.remove("is-exit");
        el.classList.add("is-enter-start");
        // Phase 3 — reflow forcé puis retour à 0 avec la transition par défaut.
        void el.offsetWidth;
        el.classList.remove("is-enter-start");
      }, SWAP_DUR_MS);
    };

    const interval = window.setInterval(tick, HOLD_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(swapTimer);
    };
  }, [host]);

  return (
    <span
      ref={spanRef}
      className="t-text-swap t-shimmer nc-transcript-loading"
      data-text=""
      aria-live="polite"
    />
  );
}
