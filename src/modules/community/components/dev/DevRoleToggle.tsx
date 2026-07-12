"use client";

import type { DevRole, DevFeedState } from "../../hooks/useDevRoleToggle";

interface DevRoleToggleProps {
  role: DevRole;
  onRoleChange: (r: DevRole) => void;
  feedState: DevFeedState;
  onFeedStateChange: (s: DevFeedState) => void;
}

const ROLES: Array<{ value: DevRole; label: string }> = [
  { value: "free", label: "Free" },
  { value: "paid", label: "Payant" },
  { value: "admin", label: "Admin" },
];

const STATES: Array<{ value: DevFeedState; label: string }> = [
  { value: "full", label: "Plein" },
  { value: "empty", label: "Vide" },
  { value: "loading", label: "Loading" },
  { value: "error", label: "Erreur" },
];

export function DevRoleToggle({ role, onRoleChange, feedState, onFeedStateChange }: DevRoleToggleProps) {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999,
        background: "rgba(15,15,15,0.95)",
        color: "#fff",
        borderRadius: 12,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontSize: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        backdropFilter: "blur(8px)",
        whiteSpace: "nowrap",
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span style={{ color: "#e0625a", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10 }}>
        DEV
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Rôle :</span>
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onRoleChange(r.value)}
            style={{
              padding: "3px 10px",
              borderRadius: 9999,
              border: "1px solid",
              borderColor: role === r.value ? "#e0625a" : "rgba(255,255,255,0.2)",
              background: role === r.value ? "rgba(224,98,90,0.25)" : "transparent",
              color: role === r.value ? "#e0625a" : "rgba(255,255,255,0.7)",
              fontSize: 11,
              fontWeight: role === r.value ? 700 : 400,
              cursor: "pointer",
              transition: "all var(--nc-duration-xfast) var(--nc-ease)",
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Feed :</span>
        {STATES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onFeedStateChange(s.value)}
            style={{
              padding: "3px 10px",
              borderRadius: 9999,
              border: "1px solid",
              borderColor: feedState === s.value ? "#e0625a" : "rgba(255,255,255,0.2)",
              background: feedState === s.value ? "rgba(224,98,90,0.25)" : "transparent",
              color: feedState === s.value ? "#e0625a" : "rgba(255,255,255,0.7)",
              fontSize: 11,
              fontWeight: feedState === s.value ? 700 : 400,
              cursor: "pointer",
              transition: "all var(--nc-duration-xfast) var(--nc-ease)",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => { onRoleChange("paid"); onFeedStateChange("full"); }}
        style={{
          padding: "3px 10px",
          borderRadius: 9999,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "transparent",
          color: "rgba(255,255,255,0.5)",
          fontSize: 10,
          cursor: "pointer",
        }}
      >
        Reset
      </button>
    </div>
  );
}
