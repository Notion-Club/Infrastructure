import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";

const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

export default function AppLoading() {
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
            style={{ maxWidth: 840, margin: "0 auto" }}
            className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10"
          >
            {/* Greeting skeleton — desktop */}
            <div className="hidden md:flex flex-col gap-4 mb-6">
              <div style={{ ...pulse, height: 14, width: 80 }} />
              <div style={{ ...pulse, height: 52, width: "52%", borderRadius: "var(--nc-radius-sm)" }} />
            </div>

            {/* Greeting skeleton — mobile */}
            <div className="md:hidden flex flex-col gap-3 mb-5">
              <div style={{ ...pulse, height: 40, width: "60%", borderRadius: "var(--nc-radius-sm)" }} />
            </div>

            {/* Widget skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div style={{ ...pulse, height: 180, borderRadius: "var(--nc-radius-md)" }} />
              <div style={{ ...pulse, height: 180, borderRadius: "var(--nc-radius-md)", animationDelay: "120ms" }} />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
