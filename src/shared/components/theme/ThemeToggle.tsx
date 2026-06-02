"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/shared/lib/hooks/useTheme";
import type { ThemePreference } from "./ThemeProvider";

type Variant = "compact" | "segmented";

const SEGMENTED_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "Système", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle({
  variant = "compact",
  ariaLabel = "Basculer le thème",
}: {
  variant?: Variant;
  ariaLabel?: string;
}) {
  const { preference, theme, setPreference, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const itemRefs       = useRef<(HTMLButtonElement | null)[]>([]);
  const pillRef        = useRef<HTMLDivElement>(null);
  const lastClickedRef = useRef<number>(-1);

  const moveTo = useCallback((idx: number, animate: boolean) => {
    const el   = itemRefs.current[idx];
    const pill = pillRef.current;
    if (!el || !pill) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = prev;
    } else {
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
    }
  }, []);

  useLayoutEffect(() => {
    if (variant !== "segmented") return;
    const idx = SEGMENTED_OPTIONS.findIndex((o) => o.value === preference);
    if (lastClickedRef.current === idx) {
      lastClickedRef.current = -1;
      return;
    }
    lastClickedRef.current = -1;
    moveTo(idx, false);
  }, [preference, moveTo, variant]);

  if (variant === "segmented") {
    return (
      <div
        role="group"
        aria-label="Choix du thème"
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 4,
          borderRadius: 9999,
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-default)",
          position: "relative",
        }}
      >
        {/* Pill glissante */}
        <div
          ref={pillRef}
          aria-hidden
          className="nc-nav-pill"
          style={{
            position: "absolute",
            left: 0,
            background: "var(--nc-segmented-active-bg)",
            boxShadow: "var(--nc-shadow-3)",
            borderRadius: 9999,
            pointerEvents: "none",
            willChange: "transform, width",
            zIndex: 0,
          }}
        />
        {SEGMENTED_OPTIONS.map(({ value, label, icon: Icon }, i) => {
          const active = preference === value;
          return (
            <button
              key={value}
              ref={(el) => { itemRefs.current[i] = el; }}
              type="button"
              onClick={() => {
                lastClickedRef.current = i;
                moveTo(i, true);
                setPreference(value);
              }}
              aria-pressed={active}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--nc-segmented-active-text)" : "var(--color-text-muted)",
                background: active ? "var(--nc-segmented-active-bg)" : "transparent",
                border: "none",
                cursor: "pointer",
                boxShadow: active ? "var(--nc-shadow-3)" : "none",
                position: "relative",
                zIndex: 1,
                transition: "background 150ms ease, box-shadow 150ms ease, color 150ms ease",
              }}
            >
              <Icon size={14} strokeWidth={active ? 2.5 : 2} />
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={ariaLabel}
      onClick={toggleTheme}
      style={{
        width: 36,
        height: 20,
        borderRadius: 9999,
        background: isDark ? "var(--color-brand)" : "rgba(0,0,0,0.12)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background 200ms ease",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: isDark ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "var(--nc-segmented-active-bg)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "left 200ms ease",
          color: "var(--color-text-secondary)",
        }}
      >
        {isDark ? <Moon size={9} /> : <Sun size={9} />}
      </span>
    </button>
  );
}
