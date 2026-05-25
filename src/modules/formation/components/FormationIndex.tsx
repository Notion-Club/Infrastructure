import { Sparkles } from "lucide-react";

import type { ProgramSummary } from "../types";
import { ProgramCard } from "./ProgramCard";

// Index des programmes (Server Component). La liste est déjà filtrée par la
// RLS selon les capabilities — pas de gating côté client.
export function FormationIndex({ programs }: { programs: ProgramSummary[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 500 }}>
          Formation
        </span>
        <h1
          style={{
            fontSize: "clamp(32px, 4vw, 44px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Tes programmes
        </h1>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", margin: 0, maxWidth: 560, lineHeight: 1.5 }}>
          Reprends là où tu en étais, ou démarre un nouveau programme.
        </p>
      </header>

      {programs.length === 0 ? (
        <EmptyState />
      ) : (
        programs.map((p) => <ProgramCard key={p.id} program={p} />)
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        marginTop: 24,
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 20,
        padding: "48px 32px",
        textAlign: "center",
        boxShadow: "var(--nc-shadow-3)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <Sparkles size={32} style={{ color: "var(--color-brand)" }} />
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
          Tu n&apos;as pas encore accès à un programme.
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "8px 0 0 0", maxWidth: 420, lineHeight: 1.5 }}>
          Tes formations apparaîtront ici dès qu&apos;une offre te donnera accès à un programme.
        </p>
      </div>
    </div>
  );
}
