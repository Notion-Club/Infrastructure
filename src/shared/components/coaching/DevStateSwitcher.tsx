"use client";

import { UserState, STATE_LABELS } from "@/shared/lib/mock/coaching";

const STATES = Object.keys(STATE_LABELS) as UserState[];

interface DevStateSwitcherProps {
  currentState: UserState;
  onChange: (state: UserState) => void;
}

// DEV ONLY — à retirer au branchement backend
export function DevStateSwitcher({ currentState, onChange }: DevStateSwitcherProps) {
  return (
    <div
      style={{
        background: "#fffbeb",
        borderBottom: "1px solid #fde68a",
        padding: "10px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#92400e",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            flexShrink: 0,
          }}
        >
          État dev :
        </span>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATES.map((state) => {
            const isActive = state === currentState;
            return (
              <button
                key={state}
                type="button"
                onClick={() => onChange(state)}
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#fff" : "#78350f",
                  background: isActive ? "#18181b" : "rgba(0,0,0,0.06)",
                  border: "none",
                  borderRadius: 9999,
                  padding: "5px 12px",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                  whiteSpace: "nowrap",
                }}
              >
                {STATE_LABELS[state]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
