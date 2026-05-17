import type { Metadata } from "next";
import { Search } from "lucide-react";
import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { FormationWidget } from "@/shared/components/dashboard/widgets/FormationWidget";
import { ProfilWidget } from "@/shared/components/dashboard/widgets/ProfilWidget";

export const metadata: Metadata = {
  title: "Accueil — Notion Club",
};

const MOCK_USER = { prenom: "Théo" };

export default function DashboardPage() {
  return (
    <div
      className="nc-page-halo flex flex-col"
      style={{ minHeight: "100dvh" }}
    >
      {/*
       * Topbar — enfant direct du flex-col pour que sticky top-0
       * fonctionne sur toute la hauteur du scroll.
       * Le hidden md:flex est géré par le composant lui-même.
       */}
      <Topbar />

      {/* Mobile components — position: fixed, masqués sur desktop */}
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>

      {/* Contenu principal */}
      <main style={{ flex: 1, position: "relative", zIndex: 1 }}>
        <div
          style={{
            maxWidth: 840,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
          className="px-4 pt-[72px] pb-[100px] md:px-10 md:pt-[96px] md:pb-10"
        >
          {/* Greeting + search — desktop uniquement */}
          <div className="hidden md:flex flex-col gap-5">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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

            {/* Search bar desktop */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "white",
                border: "1px solid var(--color-border-default)",
                borderRadius: 9999,
                padding: "11px 20px",
                maxWidth: 480,
                cursor: "pointer",
                boxShadow: "var(--nc-shadow-3)",
                transition: "box-shadow 200ms ease, border-color 200ms ease",
              }}
              className="hover:border-[var(--color-text-muted)] hover:shadow-[rgba(0,0,0,0.08)_0px_4px_24px_0px]"
            >
              <Search
                size={15}
                style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: 14,
                  color: "var(--color-text-muted)",
                  flex: 1,
                }}
              >
                Rechercher un cours, une ressource…
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 6,
                  padding: "2px 6px",
                  fontWeight: 500,
                  flexShrink: 0,
                  lineHeight: 1.5,
                }}
              >
                ⌘K
              </span>
            </div>
          </div>

          {/* Greeting — mobile uniquement */}
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

          {/* Search bar — mobile uniquement */}
          <div
            className="md:hidden flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-full px-4 py-2.5"
            style={{ cursor: "pointer" }}
          >
            <Search
              size={14}
              style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Rechercher un cours, une ressource…
            </span>
          </div>

          {/* Widgets */}
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
  );
}
