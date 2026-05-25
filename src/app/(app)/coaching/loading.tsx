import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";

const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

// Mirrors coaching/page.tsx: maxWidth 1100, padding px-4 pt-[96px] pb-[100px]
// md:px-10 md:pt-[148px] md:pb-12. Structure: header + CTA card + calls section.
export default function CoachingLoading() {
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
            className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-12"
            style={{ maxWidth: 1100, margin: "0 auto" }}
          >
            {/* CoachingHeader skeleton — titre + sous-titre + pill optionnelle */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              <div style={{ ...pulse, height: 44, width: "52%", borderRadius: "var(--nc-radius-sm)" }} />
              <div style={{ ...pulse, height: 18, width: "72%", borderRadius: 8, animationDelay: "60ms" }} />
              <div style={{ ...pulse, height: 18, width: "58%", borderRadius: 8, animationDelay: "80ms" }} />
              <div style={{ ...pulse, height: 30, width: 200, borderRadius: 9999, marginTop: 4, animationDelay: "100ms" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* CoachingCTACard skeleton — bandeau horizontal icon + texte + bouton */}
              <div
                style={{
                  ...pulse,
                  height: 96,
                  borderRadius: 20,
                  animationDelay: "80ms",
                }}
              />

              {/* Calls section skeleton — 3 rangées de cartes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ ...pulse, height: 22, width: 140, borderRadius: 8, animationDelay: "100ms" }} />
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      ...pulse,
                      height: 88,
                      borderRadius: 16,
                      animationDelay: `${120 + i * 60}ms`,
                    }}
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
