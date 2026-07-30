"use client";

import { useEffect, useRef, useState } from "react";

// Indicateur « X écrit… » — 3 points qui ondulent dans une bulle au style
// « reçu » (mêmes radius/couleurs que MessageBubble pour la cohérence). Animation
// inspirée du typing indicator interior.dev
// (https://www.interior.dev/docs/typing-indicator), portée sur les tokens du
// design system : la vague des points, l'entrée « pop » de la bulle et sa sortie
// en fondu-scale vivent dans globals.css (.nc-typing-*). Animation CSS pure — pas
// de frame loop JS.
//
// Présence auto-gérée : le parent passe `visible` (dérivé de otherIsTyping) et le
// composant reste monté le temps de jouer la sortie. Cela permet une DISPARITION
// animée alors qu'un simple `{visible && <…/>}` couperait la bulle net.

// Durée de la sortie — doit couvrir l'animation `nc-typing-out` (170ms) de
// globals.css avant de démonter réellement le nœud.
const EXIT_MS = 190;

interface TypingIndicatorProps {
  // Nom de l'autre participant — affiché en label discret au-dessus.
  authorName: string;
  // true tant que l'autre participant tape. Passe à false → on joue la sortie
  // puis on démonte.
  visible: boolean;
}

export function TypingIndicator({ authorName, visible }: TypingIndicatorProps) {
  // `mounted` : le nœud est-il dans le DOM (reste true PENDANT la sortie, pour
  // que l'animation `nc-typing-out` ait le temps de jouer avant démontage).
  // `exiting` : bascule data-exit → passe de l'anim d'entrée à celle de sortie.
  const [mounted, setMounted] = useState(visible);
  const [exiting, setExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  // Synchronisation présence ↔ prop `visible` : c'est un cas LÉGITIME de state
  // piloté par effet (patron « présence animée » de AnimatePresence /
  // react-transition-group). Garder le nœud monté via `mounted` évite le frame
  // vide (flicker) qu'un démontage immédiat provoquerait au moment où l'autre
  // cesse de taper — d'où le setState synchrone assumé ici.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      // Réapparition (ou 1re apparition) : on annule une sortie en cours et on
      // (re)monte pour rejouer l'entrée « pop ».
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setExiting(false);
      setMounted(true);
    } else if (mounted) {
      // L'autre a arrêté de taper : on joue la sortie, puis on démonte à
      // l'expiration du timer (couvre `nc-typing-out`).
      setExiting(true);
      exitTimerRef.current = window.setTimeout(() => {
        setMounted(false);
        setExiting(false);
        exitTimerRef.current = null;
      }, EXIT_MS);
    }
    return () => {
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [visible, mounted]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!mounted) return null;

  return (
    <div
      className="nc-typing-presence"
      data-exit={exiting ? "true" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        margin: "2px 0",
        gap: 2,
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--color-text-muted)",
          paddingLeft: 14,
        }}
      >
        {authorName} écrit…
      </span>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "16px 16px 16px 4px",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-default)",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Dot delay="0s" />
        <Dot delay="0.15s" />
        <Dot delay="0.3s" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="nc-typing-dot"
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--color-text-muted)",
        display: "inline-block",
        animationDelay: delay,
      }}
    />
  );
}
