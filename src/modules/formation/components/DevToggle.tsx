"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

import type {
  DevCapability,
  DevProgressLevel,
  DevSpecialState,
} from "../types";
import { useFormationContext } from "../hooks/useFormationMocks";

const CAPABILITIES: Array<{ value: DevCapability; label: string }> = [
  { value: "none", label: "none" },
  { value: "challenge_only", label: "challenge" },
  { value: "paid_only", label: "paid" },
  { value: "paid_and_challenge", label: "paid + challenge" },
];

const PROGRESS_LEVELS: Array<{ value: DevProgressLevel; label: string }> = [
  { value: 0, label: "0%" },
  { value: 30, label: "30%" },
  { value: 70, label: "70%" },
  { value: 100, label: "100%" },
];

const SPECIAL_STATES: Array<{ value: DevSpecialState; label: string }> = [
  { value: "normal", label: "normal" },
  { value: "lesson_locked", label: "lesson_locked" },
  { value: "resource_deleted", label: "resource_deleted" },
];

function capabilityLabel(v: DevCapability): string {
  return CAPABILITIES.find((c) => c.value === v)?.label ?? v;
}

// Panel flottant en bas à droite — visible uniquement quand on est en
// développement ou en preview Vercel. Bandeau de statut sticky en haut
// de page géré par <DevModeBanner /> (composant séparé).
export function DevToggle() {
  const {
    devCapability,
    setDevCapability,
    devProgressLevel,
    setDevProgressLevel,
    devSpecial,
    setDevSpecial,
  } = useFormationContext();

  const [open, setOpen] = useState(true);

  // Visible en preview Vercel (NODE_ENV=production mais VERCEL_ENV=preview)
  // et en dev local. En prod stricte (main → vercel prod), on cache.
  const isProd =
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview";
  if (isProd) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        right: 16,
        zIndex: 999,
        background: "rgba(15,15,15,0.95)",
        color: "#fff",
        borderRadius: 14,
        padding: open ? "10px 14px" : "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: open ? 10 : 0,
        fontSize: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        maxWidth: "calc(100vw - 32px)",
        minWidth: open ? 320 : 0,
      }}
    >
      {/* Header / toggle open */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <span
          style={{
            color: "#e0625a",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontSize: 10,
          }}
        >
          DEV · Formation
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {open && (
        <>
          <DevRow label="Capability">
            {CAPABILITIES.map((c) => (
              <DevPill
                key={c.value}
                active={devCapability === c.value}
                onClick={() => setDevCapability(c.value)}
              >
                {c.label}
              </DevPill>
            ))}
          </DevRow>

          <DevRow label="Progression">
            {PROGRESS_LEVELS.map((p) => (
              <DevPill
                key={p.value}
                active={devProgressLevel === p.value}
                onClick={() => setDevProgressLevel(p.value)}
              >
                {p.label}
              </DevPill>
            ))}
          </DevRow>

          <DevRow label="État spécial">
            {SPECIAL_STATES.map((s) => (
              <DevPill
                key={s.value}
                active={devSpecial === s.value}
                onClick={() => setDevSpecial(s.value)}
              >
                {s.label}
              </DevPill>
            ))}
          </DevRow>

          <button
            type="button"
            onClick={() => {
              setDevCapability("paid_and_challenge");
              setDevProgressLevel(30);
              setDevSpecial("normal");
            }}
            style={{
              alignSelf: "flex-end",
              padding: "3px 10px",
              borderRadius: 9999,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </>
      )}
    </div>
  );
}

function DevRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          color: "rgba(255,255,255,0.5)",
          fontSize: 10,
          minWidth: 80,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}

function DevPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "3px 9px",
        borderRadius: 9999,
        border: "1px solid",
        borderColor: active ? "#e0625a" : "rgba(255,255,255,0.2)",
        background: active ? "rgba(224,98,90,0.25)" : "transparent",
        color: active ? "#e0625a" : "rgba(255,255,255,0.7)",
        fontSize: 11,
        fontWeight: active ? 700 : 400,
        cursor: "pointer",
        transition: "all 150ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

// Bandeau de statut sticky en haut de page — visible quand le toggle est
// actif (dev / preview). Permet de voir l'état simulé sans devoir ouvrir
// le panel flottant.
export function DevModeBanner() {
  const { devCapability, devProgressLevel, devSpecial } = useFormationContext();

  const isProd =
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview";
  if (isProd) return null;

  return (
    <div
      style={{
        background: "#fffbeb",
        borderBottom: "1px solid #fde68a",
        padding: "8px 16px",
        textAlign: "center",
        fontSize: 11,
        fontWeight: 600,
        color: "#92400e",
        letterSpacing: "0.02em",
      }}
    >
      Mode simulation — {capabilityLabel(devCapability)} · {devProgressLevel}% ·{" "}
      {devSpecial}
    </div>
  );
}
