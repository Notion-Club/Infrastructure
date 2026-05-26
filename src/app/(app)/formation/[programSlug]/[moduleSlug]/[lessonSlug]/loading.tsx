const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

// Renders inside formation/layout.tsx — mirrors LessonView exactly.
// viewTransitionName on the player card enables the morph animation (Scénario C).
export default function LessonLoading() {
  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ ...pulse, height: 14, width: 300 }} />

      {/* Player card + Notebook */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Player card — viewTransitionName matches LessonPlayerCard */}
        <div
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "var(--nc-shadow-2)",
            viewTransitionName: "lesson-card",
          }}
        >
          {/* Title + description area */}
          <div style={{ padding: "22px 24px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...pulse, height: 28, width: "68%" }} />
            <div style={{ ...pulse, height: 16, width: "52%", animationDelay: "60ms" }} />
          </div>

          {/* Video area (16:9) */}
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              background: "var(--color-surface-raised)",
            }}
          />

          {/* Body text lines */}
          <div style={{ padding: "18px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 60, 100, 140].map((delay) => (
              <div
                key={delay}
                style={{
                  ...pulse,
                  height: 14,
                  width: delay === 140 ? "55%" : `${82 + delay * 0.04}%`,
                  animationDelay: `${delay}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Notebook skeleton — tabs + notes area */}
        <div style={{ ...pulse, height: 220, borderRadius: 20, animationDelay: "80ms" }} />
      </div>

      {/* Navigation: prev + next buttons */}
      <div style={{ padding: "20px 0 4px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ ...pulse, height: 44, width: 164, borderRadius: 9999, animationDelay: "60ms" }} />
        <div style={{ ...pulse, height: 44, width: 164, borderRadius: 9999, animationDelay: "100ms" }} />
      </div>
    </div>
  );
}
