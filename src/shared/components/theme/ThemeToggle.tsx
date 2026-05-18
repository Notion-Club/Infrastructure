"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/shared/lib/hooks/useTheme";

type Variant = "compact" | "segmented";

export function ThemeToggle({
  variant = "compact",
  ariaLabel = "Basculer le thème",
}: {
  variant?: Variant;
  ariaLabel?: string;
}) {
  const { theme, setTheme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

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
        }}
      >
        {(["light", "dark"] as const).map((value) => {
          const active = theme === value;
          const Icon = value === "light" ? Sun : Moon;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active
                  ? "var(--color-text-primary)"
                  : "var(--color-text-muted)",
                background: active ? "white" : "transparent",
                border: "none",
                cursor: "pointer",
                boxShadow: active ? "var(--nc-shadow-3)" : "none",
                transition: "all 150ms ease",
              }}
            >
              <Icon size={14} strokeWidth={active ? 2.5 : 2} />
              {value === "light" ? "Light" : "Dark"}
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
          background: "white",
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
