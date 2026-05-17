import type { Metadata } from "next";
import { Sidebar } from "@/shared/components/dashboard/Sidebar";
import { FormationWidget } from "@/shared/components/dashboard/widgets/FormationWidget";
import { ProfilWidget } from "@/shared/components/dashboard/widgets/ProfilWidget";

export const metadata: Metadata = {
  title: "Accueil — Notion Club",
};

const MOCK_USER = { prenom: "Théo" };

export default function DashboardPage() {
  return (
    <div
      className="nc-page-halo flex overflow-hidden"
      style={{ height: "100dvh" }}
    >
      <Sidebar />

      <main
        style={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: 840,
            margin: "0 auto",
            padding: "48px 40px 64px",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          {/* Greeting */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
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
  );
}
