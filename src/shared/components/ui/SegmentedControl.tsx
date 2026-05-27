"use client";

/**
 * SegmentedControl — switcher à onglets avec indicateur glissant animé.
 *
 * === Mécanique du glissement fluide ===
 *
 * 1. layoutId
 *    Le pill est rendu à l'intérieur de chaque bouton ACTIF. Quand l'onglet
 *    change, Framer Motion détecte le même layoutId qui se déplace d'un
 *    parent à l'autre et anime la transition via FLIP (First, Last, Invert,
 *    Play) — sans getBoundingClientRect ni useLayoutEffect.
 *    C'est plus fiable que l'approche animate={{ x, width }} car
 *    l'animation part directement de la position DOM réelle, indépendamment
 *    du cycle de rendu React.
 *
 * 2. Spring config
 *    stiffness: 420  → réactivité (plus haut = plus rapide)
 *    damping:   30   → amorti (plus bas = plus d'overshoot)
 *    mass:      0.85 → inertie légère (plus bas = ressort vif)
 *
 *    Pour plus de bounce : baisser damping (ex. 22) ou mass (ex. 0.6).
 *    Pour du smooth sans overshoot : stiffness 300, damping 38.
 *
 * 3. AnimatePresence (contenu)
 *    mode="wait" attend la sortie avant l'entrée — évite deux contenus
 *    superposés. Le mouvement Y est subtil (±6px) pour ne pas distraire.
 */

import { AnimatePresence, motion } from "framer-motion";

export type Tab<T extends string = string> = {
  label: string;
  value: T;
  /** Icône optionnelle (Lucide ou autre) */
  icon?: React.ReactNode;
};

type Props<T extends string> = {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Contenu affiché sous le switcher, keyed par tab active */
  children?: React.ReactNode;
  /** Padding interne du switcher (défaut : 4px) */
  padding?: number;
  /** Identifiant unique pour le layoutId — isoler si plusieurs instances */
  layoutId?: string;
};

export function SegmentedControl<T extends string>({
  tabs,
  value,
  onChange,
  children,
  padding = 4,
  layoutId = "segmented-pill",
}: Props<T>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Switcher ── */}
      <div
        role="tablist"
        aria-label="Onglets"
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "var(--color-surface-raised)",
          borderRadius: 9999,
          padding,
          gap: 2,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.value === value;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onChange(tab.value)}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 18px",
                borderRadius: 9999,
                border: "none",
                background: "transparent",
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 180ms ease",
                userSelect: "none",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "var(--color-surface-card)",
                    borderRadius: 9999,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)",
                    zIndex: -1,
                  }}
                  transition={SPRING}
                />
              )}
              {tab.icon && (
                <span style={{ display: "inline-flex", position: "relative", opacity: isActive ? 1 : 0.55, transition: "opacity 180ms ease" }}>
                  {tab.icon}
                </span>
              )}
              <span style={{ position: "relative" }}>{tab.label}</span>
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
