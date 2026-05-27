"use client";

/**
 * SegmentedControl — switcher à onglets avec indicateur glissant animé.
 *
 * === Mécanique du glissement fluide ===
 *
 * 1. Mesure dynamique (getBoundingClientRect)
 *    useLayoutEffect recalcule la position absolue du bouton actif à chaque
 *    changement de `value`. On stocke { x, width } relatifs au conteneur.
 *
 * 2. Framer Motion spring (motion.div)
 *    Le pill est un <motion.div> positionné en `left: 0`. On anime `x`
 *    (transform: translateX) et `width` avec un ressort.
 *    Pourquoi `x` plutôt que `left` : les transforms sont GPU-accélérés
 *    (pas de reflow), ce qui garantit 60 fps même sur mobile.
 *
 * 3. initial={false}
 *    Empêche Framer Motion d'animer depuis la valeur par défaut (0) vers la
 *    position initiale au montage — le pill apparaît directement à la bonne
 *    position, sans glissement parasite.
 *
 * 4. Spring config
 *    stiffness: 420  → réactivité (plus haut = plus rapide)
 *    damping:   30   → amorti (plus bas = plus d'overshoot)
 *    mass:      0.85 → inertie légère (plus bas = ressort vif)
 *
 *    Pour plus de bounce : baisser damping (ex. 22) ou mass (ex. 0.6).
 *    Pour du smooth sans overshoot : stiffness 300, damping 38.
 *
 * 5. AnimatePresence (contenu)
 *    mode="wait" attend la sortie avant l'entrée — évite deux contenus
 *    superposés. Le mouvement Y est subtil (±6px) pour ne pas distraire.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type Tab<T extends string = string> = {
  label: string;
  value: T;
  /** Icône optionnelle (Lucide ou autre) */
  icon?: React.ReactNode;
};

type PillGeom = { x: number; width: number; height: number };

type Props<T extends string> = {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Contenu affiché sous le switcher, keyed par tab active */
  children?: React.ReactNode;
  /** Padding interne du switcher (défaut : 4px) */
  padding?: number;
};

export function SegmentedControl<T extends string>({
  tabs,
  value,
  onChange,
  children,
  padding = 4,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<PillGeom | null>(null);

  // Mesure la position du bouton actif à chaque changement de valeur.
  useLayoutEffect(() => {
    const idx = tabs.findIndex((t) => t.value === value);
    const container = containerRef.current;
    const btn = btnRefs.current[idx];
    if (!container || !btn) return;

    const cr = container.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setPill({
      x: br.left - cr.left - padding,
      width: br.width,
      height: br.height,
    });
  }, [value, tabs, padding]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Switcher ── */}
      <div
        ref={containerRef}
        role="tablist"
        aria-label="Onglets"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          background: "var(--color-surface-raised)",
          borderRadius: 9999,
          padding,
          gap: 2,
        }}
      >
        {/* Indicateur glissant */}
        {pill && (
          <motion.div
            aria-hidden
            initial={false}
            animate={{ x: pill.x, width: pill.width, height: pill.height }}
            transition={SPRING}
            style={{
              position: "absolute",
              left: padding,
              top: padding,
              background: "var(--color-surface-card)",
              borderRadius: 9999,
              boxShadow:
                "0 1px 4px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}

        {tabs.map((tab, i) => {
          const isActive = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onChange(tab.value)}
              style={{
                position: "relative",
                zIndex: 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 18px",
                borderRadius: 9999,
                border: "none",
                background: "transparent",
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? "var(--color-text-primary)"
                  : "var(--color-text-muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 180ms ease",
                userSelect: "none",
              }}
            >
              {tab.icon && (
                <span style={{ display: "inline-flex", opacity: isActive ? 1 : 0.55, transition: "opacity 180ms ease" }}>
                  {tab.icon}
                </span>
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Contenu : fade + léger translateY au changement d'onglet ── */}
      {children !== undefined && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={CONTENT_TRANSITION}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Configs d'animation ──────────────────────────────────────────────────────

/**
 * Spring pour le pill glissant.
 *
 * Lecture rapide des paramètres :
 *   stiffness ↑  →  glissement plus sec/rapide
 *   damping   ↓  →  plus d'overshoot (rebond)
 *   mass      ↓  →  ressort vif, peu d'inertie
 *
 * Preset "organique avec micro-bounce" :
 *   { stiffness: 420, damping: 30, mass: 0.85 }   ← défaut ci-dessous
 *
 * Preset "ultra-smooth sans overshoot" :
 *   { stiffness: 300, damping: 38, mass: 1 }
 *
 * Preset "bouncier iOS" :
 *   { stiffness: 500, damping: 24, mass: 0.75 }
 */
const SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 30,
  mass: 0.85,
};

const CONTENT_TRANSITION = {
  duration: 0.16,
  ease: [0.4, 0, 0.2, 1] as const,
};
