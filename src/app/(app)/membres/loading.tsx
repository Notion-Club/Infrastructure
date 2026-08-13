// Skeleton plateforme de /membres — miroir du shell de MembresPageClient
// (maxWidth 1000, paddings responsive identiques) : en-tête, bande KPIs,
// toolbar, puis grille de cartes membre. Utilise `.nc-skeleton` (globals.css).

const pulse: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

export default function MembresLoading() {
  return (
    <div className="nc-page-halo" style={{ minHeight: "100lvh" }}>
      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          className="px-4 pt-[96px] pb-[120px] md:px-10 md:pt-[148px] md:pb-12"
          style={{ maxWidth: 1000, margin: "0 auto" }}
        >
          {/* En-tête */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="nc-skeleton" style={{ ...pulse, height: 12, width: 130, borderRadius: 8 }} />
              <div className="nc-skeleton" style={{ ...pulse, height: 26, width: 240, borderRadius: 10 }} />
            </div>
            <div className="nc-skeleton" style={{ ...pulse, height: 34, width: 120, borderRadius: 100 }} />
          </div>

          {/* KPIs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                style={{
                  background: "var(--color-surface-card)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 16,
                  boxShadow: "var(--nc-shadow-3)",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div className="nc-skeleton" style={{ ...pulse, height: 12, width: "60%", borderRadius: 8, animationDelay: `${i * 60}ms` }} />
                <div className="nc-skeleton" style={{ ...pulse, height: 26, width: "45%", borderRadius: 8, animationDelay: `${i * 60 + 40}ms` }} />
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
            <div className="nc-skeleton" style={{ ...pulse, height: 44, flex: 1, minWidth: 220, borderRadius: 12 }} />
            <div className="nc-skeleton" style={{ ...pulse, height: 44, width: 180, borderRadius: 12 }} />
          </div>

          {/* Grille de cartes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))",
              gap: 18,
            }}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="nc-skeleton"
                style={{
                  ...pulse,
                  aspectRatio: "3 / 4",
                  borderRadius: 16,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
