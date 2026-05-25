import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";

const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

export default function RessourcesLoading() {
  return (
    <>
      <Topbar />
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>

      <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[176px] md:px-10 md:pt-[148px] md:pb-[140px]">
            <div
              style={{
                maxWidth: 1040,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 28,
              }}
            >
              {/* Header: label + h1 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ ...pulse, height: 13, width: 84 }} />
                <div style={{ ...pulse, height: 60, width: "38%", borderRadius: "var(--nc-radius-sm)", animationDelay: "60ms" }} />
              </div>

              {/* Filter bar: pill buttons + sort icon */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {[0, 80, 160].map((delay) => (
                  <div key={delay} style={{ ...pulse, height: 37, width: 96, borderRadius: 9999, animationDelay: `${delay}ms` }} />
                ))}
                <div style={{ ...pulse, height: 37, width: 37, borderRadius: 9999, marginLeft: "auto", animationDelay: "200ms" }} />
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    style={{ ...pulse, height: 180, borderRadius: 16, animationDelay: `${i * 40}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
