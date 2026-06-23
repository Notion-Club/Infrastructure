const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

// Mirrors coaching/page.tsx : shell à hauteur fixe (h-dvh + overflow-hidden,
// aligné sur /communaute), encadré global unique (Slot 1 bannière + Slot 2
// historique). maxWidth 1000, paddings responsive identiques à la page client.
export default function CoachingLoading() {
  return (
    <div className="nc-page-halo flex flex-col h-dvh overflow-hidden">
      <main
        className="flex flex-col flex-1 min-h-0"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div
          className="px-4 pt-[64px] pb-[120px] md:px-10 md:pt-[104px] md:pb-8 w-full flex flex-col flex-1 min-h-0"
          style={{ maxWidth: 1000, margin: "0 auto" }}
        >
          {/* Encadré global */}
          <div
            className="flex flex-col flex-1 min-h-0"
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 20,
              boxShadow: "var(--nc-shadow-3)",
              padding: 14,
            }}
          >
            {/* Slot 1 — bannière hero skeleton */}
            <div
              style={{
                flexShrink: 0,
                borderRadius: 16,
                border: "1px solid var(--color-border-default)",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ ...pulse, height: 38, width: "48%", borderRadius: "var(--nc-radius-sm)" }} />
              <div style={{ ...pulse, height: 16, width: "70%", borderRadius: 8, animationDelay: "60ms" }} />
              <div style={{ ...pulse, height: 44, width: 220, borderRadius: 9999, marginTop: 6, animationDelay: "100ms" }} />
            </div>

            {/* Slot 2 — switcher + grille skeleton */}
            <div
              className="flex-1 min-h-0 overflow-y-auto"
              style={{ padding: "20px 10px 8px", display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ ...pulse, height: 40, width: "100%", borderRadius: 10, animationDelay: "80ms" }} />
              <div
                className="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      ...pulse,
                      height: 88,
                      borderRadius: 14,
                      animationDelay: `${120 + i * 60}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
