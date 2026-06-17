"use client";

import { useEffect, useRef } from "react";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";

// Indicateur discret d'auto-enregistrement, affiché près du titre des cartes
// Réglages (Notifications, Profil). Remplace les anciens boutons « Enregistrer »
// + toasts par un retour visuel léger et non bruyant.
//
// L'apparition / le changement d'état rejoue l'entrée floutée du pattern
// `text-states-swap` de transitions-dev (classe `.t-text-swap`, définie dans
// globals.css avec son guard `prefers-reduced-motion`). On ne réécrit aucun
// @keyframes ad hoc — on réutilise la transition existante du repo.

export type SaveState = "idle" | "saving" | "saved" | "error";

const CONFIG: Record<
  Exclude<SaveState, "idle">,
  { label: string; color: string; spin: boolean; Icon: typeof Check }
> = {
  saving: {
    label: "Enregistrement…",
    color: "var(--color-text-muted)",
    spin: true,
    Icon: LoaderCircle,
  },
  saved: {
    label: "Enregistré",
    color: "var(--color-text-muted)",
    spin: false,
    Icon: Check,
  },
  error: {
    label: "Échec de l'enregistrement",
    color: "var(--color-brand)",
    spin: false,
    Icon: TriangleAlert,
  },
};

export function SaveStatus({ state }: { state: SaveState }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevState = useRef<SaveState>(state);

  // À chaque changement d'état visible, rejoue l'entrée (montée + dé-floutage)
  // via le couple `.is-enter-start` → reflow → retrait, repris verbatim du
  // snippet text-states-swap.
  useEffect(() => {
    if (prevState.current === state) return;
    prevState.current = state;
    const el = ref.current;
    if (!el) return;
    el.classList.add("is-enter-start");
    void el.offsetHeight; // reflow → l'état de repos s'anime
    el.classList.remove("is-enter-start");
  }, [state]);

  if (state === "idle") return null;

  const { label, color, spin, Icon } = CONFIG[state];

  return (
    <span
      ref={ref}
      role="status"
      aria-live="polite"
      className="t-text-swap"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 500,
        color,
        whiteSpace: "nowrap",
      }}
    >
      <Icon
        size={13}
        className={spin ? "animate-spin" : undefined}
        aria-hidden
      />
      {label}
    </span>
  );
}
