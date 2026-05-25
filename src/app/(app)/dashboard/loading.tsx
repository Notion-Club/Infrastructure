import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";

const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

export default function DashboardLoading() {
  return (
    <>
      <Topbar />
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>

      <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              maxWidth: 840,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
            className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10"
          >
            {/* Desktop: greeting + search bar */}
            <div className="hidden md:flex flex-col gap-5">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ ...pulse, height: 13, width: 72 }} />
                <div style={{ ...pulse, height: 58, width: "52%", borderRadius: "var(--nc-radius-sm)", animationDelay: "60ms" }} />
              </div>
              <div style={{ ...pulse, height: 46, maxWidth: 480, borderRadius: 9999, animationDelay: "100ms" }} />
            </div>

            {/* Mobile: greeting + search bar */}
            <div className="md:hidden flex flex-col gap-3">
              <div style={{ ...pulse, height: 48, width: "62%", borderRadius: "var(--nc-radius-sm)" }} />
              <div style={{ ...pulse, height: 40, borderRadius: 9999, animationDelay: "60ms" }} />
            </div>

            {/* Widgets grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div style={{ ...pulse, height: 220, borderRadius: 16 }} />
              <div style={{ ...pulse, height: 220, borderRadius: 16, animationDelay: "80ms" }} />
              <div
                className="col-span-1 md:col-span-2"
                style={{ ...pulse, height: 80, borderRadius: 16, animationDelay: "140ms" }}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
