"use client";

// Panneau d'outils dev de la page Coaching, affiché dans la toolbox de la
// barre de navigation (cf. DevToolbox). Permet de basculer entre les 6 états
// de l'offre via des toggles. DEV ONLY — à retirer au branchement backend.

import { type UserState, STATE_LABELS } from "@/shared/lib/mock/coaching";

const STATES = Object.keys(STATE_LABELS) as UserState[];

interface CoachingDevToolsProps {
  current: UserState;
  onChange: (state: UserState) => void;
}

export function CoachingDevTools({ current, onChange }: CoachingDevToolsProps) {
  return (
    <div data-fb-label="Outils dev · Coaching">
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-muted)",
          margin: "2px 6px 8px",
        }}
      >
        État de la page
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {STATES.map((state) => {
          const active = state === current;
          return (
            <button
              key={state}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => onChange(state)}
              data-fb-label="Toggle état · Outils dev"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                width: "100%",
                padding: "8px 10px",
                border: "none",
                background: active ? "var(--color-surface-raised)" : "transparent",
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                transition: "background var(--nc-duration-xfast) var(--nc-ease)",
              }}
              className="hover:bg-[var(--color-surface-raised)]"
            >
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                  color: "var(--color-text-primary)",
                }}
              >
                {STATE_LABELS[state]}
              </span>
              <DevToggle on={active} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DevToggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 36,
        height: 20,
        borderRadius: 9999,
        background: on ? "var(--color-brand)" : "var(--nc-switch-off-bg)",
        position: "relative",
        flexShrink: 0,
        transition: "background var(--nc-duration-fast) var(--nc-ease)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transform: on ? "translateX(16px)" : "translateX(0)",
          transition: "transform 220ms var(--nc-ease)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}
      />
    </span>
  );
}
