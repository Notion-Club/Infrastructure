const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

// Renders inside formation/layout.tsx's padded container — no chrome needed.
export default function FormationLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header: label + h1 + description */}
      <header style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
        <div style={{ ...pulse, height: 12, width: 72 }} />
        <div style={{ ...pulse, height: 42, width: "50%", borderRadius: "var(--nc-radius-sm)", animationDelay: "60ms" }} />
        <div style={{ ...pulse, height: 34, width: "78%", borderRadius: 8, animationDelay: "100ms" }} />
      </header>

      {/* ProgramCard skeleton */}
      <div style={{ ...pulse, height: 260, borderRadius: 20, animationDelay: "120ms" }} />
    </div>
  );
}
