import type { Metadata } from "next";
import { Search } from "lucide-react";
import { Sidebar } from "@/shared/components/dashboard/Sidebar";
import { MobileHeader } from "@/shared/components/dashboard/mobile/MobileHeader";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { FormationWidget } from "@/shared/components/dashboard/widgets/FormationWidget";
import { ProfilWidget } from "@/shared/components/dashboard/widgets/ProfilWidget";

export const metadata: Metadata = {
  title: "Accueil — Notion Club",
};

const MOCK_USER = { prenom: "Théo" };

export default function DashboardPage() {
  return (
    <>
      {/* ── Mobile layout ───────────────────────────────────────── */}
      <MobileHeader />
      <BottomNav />

      {/* ── Shell flex (desktop sidebar + main) ─────────────────── */}
      <div
        className="nc-page-halo flex overflow-hidden"
        style={{ height: "100dvh" }}
      >
        {/* Sidebar — hidden on mobile via its own className */}
        <Sidebar />

        {/* Main content */}
        <main
          style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}
        >
          <div
            style={{
              maxWidth: 840,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
            /* Mobile: top padding accounts for fixed header (60px) + breathing room.
               Bottom padding accounts for fixed bottom nav (56px + 10px gap + breathing room).
               Desktop: symmetric padding. */
            className="px-4 pt-[80px] pb-[100px] md:px-10 md:py-12"
          >
            {/* Greeting — desktop only (mobile header shows the greeting) */}
            <div className="hidden md:flex flex-col gap-1">
              <p
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  margin: 0,
                }}
              >
                Bon retour
              </p>
              <h1
                style={{
                  fontSize: "clamp(24px, 3vw, 36px)",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: "var(--color-text-primary)",
                  margin: 0,
                  lineHeight: 1.15,
                }}
              >
                Salut {MOCK_USER.prenom}&nbsp;👋
              </h1>
            </div>

            {/* Greeting — mobile only */}
            <div className="md:hidden flex flex-col gap-1">
              <h1
                style={{
                  fontSize: "clamp(22px, 5vw, 28px)",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: "var(--color-text-primary)",
                  margin: 0,
                  lineHeight: 1.15,
                }}
              >
                Salut {MOCK_USER.prenom}&nbsp;👋
              </h1>
            </div>

            {/* Search bar — mobile only (static) */}
            <div
              className="md:hidden flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-full px-4 py-2.5"
              style={{ cursor: "pointer" }}
            >
              <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                Rechercher un cours, une ressource…
              </span>
            </div>

            {/* Widgets grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormationWidget />
              <ProfilWidget />

              {/* Placeholder zone future */}
              <div
                className="col-span-1 md:col-span-2"
                style={{
                  border: "1.5px dashed var(--color-border-default)",
                  borderRadius: 16,
                  background: "transparent",
                  height: 80,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    color: "var(--color-border-default)",
                    lineHeight: 1,
                  }}
                >
                  +
                </span>
                Communauté · Coaching · à venir
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
