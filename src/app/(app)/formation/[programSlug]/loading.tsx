const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

// Renders inside formation/layout.tsx's padded container — no chrome needed.
export default function ProgramLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Back link */}
      <div style={{ ...pulse, height: 18, width: 148 }} />

      {/* Header: h1 + description + progress */}
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...pulse, height: 48, width: "62%", borderRadius: "var(--nc-radius-sm)", animationDelay: "60ms" }} />
        <div style={{ ...pulse, height: 36, width: "80%", borderRadius: 8, animationDelay: "80ms" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, maxWidth: 480 }}>
          <div style={{ ...pulse, height: 8, borderRadius: 9999, animationDelay: "100ms" }} />
          <div style={{ ...pulse, height: 16, width: "50%", borderRadius: 6, animationDelay: "120ms" }} />
        </div>
      </header>

      {/* Module accordion rows */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            style={{ ...pulse, height: 56, borderRadius: 16, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </section>
    </div>
  );
}
