"use client";

// Switcher à pilule glissante réutilisable — extrait du pattern `moveTabTo`
// du switcher Communauté (`community-page.tsx`). Partagé entre l'historique
// du coaching (Slot 2) et la modale détail (onglets Plan d'actions /
// Transcription) pour garder une seule implémentation de l'animation.
//
// La pilule absolue glisse en `transform: translateX()` + `width` quand
// l'onglet change ; au montage / resize, elle se positionne sans animation.

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

export interface CoachingTabDef<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface CoachingTabsProps<T extends string> {
  tabs: CoachingTabDef<T>[];
  active: T;
  onChange: (value: T) => void;
  // Pleine largeur (chaque onglet flex:1) — utilisé sur mobile / historique.
  fullWidth?: boolean;
  ariaLabel?: string;
}

export function CoachingTabs<T extends string>({
  tabs,
  active,
  onChange,
  fullWidth = true,
  ariaLabel,
}: CoachingTabsProps<T>) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pillRef = useRef<HTMLDivElement>(null);
  const lastClickedRef = useRef<number>(-1);

  const moveTabTo = useCallback((idx: number, animate: boolean) => {
    const el = itemRefs.current[idx];
    const pill = pillRef.current;
    if (!el || !pill) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.top = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width = `${el.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = prev;
    } else {
      pill.style.top = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width = `${el.offsetWidth}px`;
    }
  }, []);

  const activeIndex = tabs.findIndex((t) => t.value === active);

  // Repositionne sans animation quand l'onglet actif change pour une raison
  // autre qu'un clic (montage, switch programmatique). On dépend de
  // `activeIndex` (primitif) et non du tableau `tabs` : sinon chaque re-render
  // parent (chargement transcription, scroll…) recrée `tabs` et relancerait
  // l'effet, ce qui couperait l'animation de glisse en plein milieu.
  useLayoutEffect(() => {
    if (activeIndex < 0) return;
    if (lastClickedRef.current === activeIndex) {
      lastClickedRef.current = -1;
      return;
    }
    lastClickedRef.current = -1;
    moveTabTo(activeIndex, false);
  }, [activeIndex, moveTabTo]);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        background: "var(--color-surface-raised)",
        borderRadius: 10,
        padding: 3,
        gap: 2,
        position: "relative",
      }}
    >
      {/* Pilule glissante */}
      <div
        ref={pillRef}
        aria-hidden
        className="nc-nav-pill"
        style={{
          position: "absolute",
          left: 0,
          background: "var(--nc-segmented-active-bg)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)",
          borderRadius: 8,
          pointerEvents: "none",
          willChange: "transform, width",
          zIndex: 0,
        }}
      />

      {tabs.map((tab, i) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-fb-label={`Onglet « ${tab.label} » · Switcher coaching`}
            onClick={() => {
              lastClickedRef.current = i;
              moveTabTo(i, true);
              onChange(tab.value);
            }}
            style={{
              flex: fullWidth ? 1 : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: isActive
                ? "var(--nc-segmented-active-bg)"
                : "transparent",
              boxShadow: isActive
                ? "0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)"
                : "none",
              color: isActive
                ? "var(--nc-segmented-active-text)"
                : "var(--color-text-muted)",
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              position: "relative",
              zIndex: 1,
              transition:
                "background 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease), color 200ms ease",
              whiteSpace: "nowrap",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
