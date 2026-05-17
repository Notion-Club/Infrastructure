import type { Metadata } from "next";
import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { ResourcesGrid } from "@/modules/ressources/components/ResourcesGrid";
import type { Resource } from "@/modules/ressources/types";

export const metadata: Metadata = {
  title: "Ressources — Notion Club",
};

const MOCK_RESOURCES: Resource[] = [
  {
    id: "1",
    title: "Template Notion Productivité All-in-One",
    description:
      "Un système complet pour gérer tes projets, tâches et objectifs au quotidien dans Notion.",
    type: "template",
    tags: ["Productivité", "Gestion de projet"],
    formation: "Module 1",
  },
  {
    id: "2",
    title: "Guide : Maîtriser les bases de données Notion",
    description:
      "Tout ce qu'il faut savoir pour créer, lier et exploiter des bases de données puissantes dans Notion.",
    type: "guide",
    tags: ["Notion Basics", "Bases de données"],
    formation: "Module 3",
  },
  {
    id: "3",
    title: "Redif : Session live Notion x IA",
    description:
      "Replay de la session live sur l'intégration de l'intelligence artificielle dans ton workflow Notion.",
    type: "redif",
    tags: ["IA", "Workflow"],
    formation: "Module 6",
  },
  {
    id: "4",
    title: "Template CRM Notion",
    description:
      "Gère tes clients, prospects et opportunités directement dans Notion sans outil externe.",
    type: "template",
    tags: ["Business", "CRM"],
    formation: "Module 4",
    locked: true,
  },
  {
    id: "5",
    title: "Guide : Automatisations Notion",
    description:
      "Crée des automatisations puissantes avec Notion et des outils tiers comme Make ou Zapier.",
    type: "guide",
    tags: ["Automatisation", "Productivité"],
    formation: "Module 5",
    locked: true,
  },
  {
    id: "6",
    title: "Template Second Cerveau",
    description:
      "Capture, organise et retrouve toutes tes idées avec ce système PKM (Personal Knowledge Management) complet.",
    type: "template",
    tags: ["PKM", "Productivité"],
    formation: "Module 2",
  },
  {
    id: "7",
    title: "Guide : Créer son système de veille avec Notion",
    description:
      "Mets en place un workflow de veille automatisé pour ne jamais rater une information clé.",
    type: "guide",
    tags: ["Veille", "Workflow"],
    formation: "Module 2",
  },
  {
    id: "8",
    title: "Redif : Workshop Bases de données relationnelles",
    description:
      "Replay du workshop sur les relations entre bases de données et les vues avancées dans Notion.",
    type: "redif",
    tags: ["Bases de données", "Notion Basics"],
    formation: "Module 3",
    locked: true,
  },
  {
    id: "9",
    title: "Template Dashboard IA",
    description:
      "Un tableau de bord pour piloter tes projets IA, centraliser tes prompts et suivre tes expériences.",
    type: "template",
    tags: ["IA", "Gestion de projet"],
    formation: "Module 6",
    locked: true,
  },
];

export default function RessourcesPage() {
  return (
    <div
      className="nc-page-halo flex flex-col"
      style={{ minHeight: "100dvh" }}
    >
      <Topbar />

      {/* Mobile components — position: fixed, masqués sur desktop */}
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>

      <main style={{ flex: 1, position: "relative", zIndex: 1 }}>
        <div
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
          className="px-4 pt-[72px] pb-[100px] md:px-10 md:pt-[96px] md:pb-10"
        >
          {/* Page header */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <p
              style={{
                fontSize: 13,
                color: "var(--color-text-muted)",
                margin: 0,
              }}
            >
              Bibliothèque
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
              Ressources
            </h1>
          </div>

          <ResourcesGrid resources={MOCK_RESOURCES} />
        </div>
      </main>
    </div>
  );
}
