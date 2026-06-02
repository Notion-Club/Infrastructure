const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

// Generic fallback — shown when (app)/layout.tsx is resolving auth,
// or for routes that don't have a dedicated loading.tsx.
export default function AppLoading() {
  return (
    <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ ...pulse, height: 40, width: "45%", borderRadius: "var(--nc-radius-sm)" }} />
              <div style={{ ...pulse, height: 180, borderRadius: "var(--nc-radius-md)" }} />
              <div style={{ ...pulse, height: 120, borderRadius: "var(--nc-radius-md)", animationDelay: "80ms" }} />
            </div>
          </div>
        </main>
    </div>
  );
}
