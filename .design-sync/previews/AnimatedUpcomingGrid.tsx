import { AnimatedUpcomingGrid } from "notionclub-infra";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 760, background: "var(--color-surface-page)", padding: 24 }}>
    {children}
  </div>
);

// Deux appels à venir côte à côte (grille md:grid-cols-2).
export const Default = () => (
  <Frame>
    <AnimatedUpcomingGrid
      calls={[
        {
          id: "1",
          date: "2026-06-22T14:00:00Z",
          host: "Théo",
          subject: "Aide setup CRM client",
          status: "upcoming",
          reschedule_url: "https://fillout.com/reschedule/abc",
        },
        {
          id: "9",
          date: "2026-06-25T10:30:00Z",
          host: "Noah",
          subject: "Architecture de la base CRM",
          status: "upcoming",
          reschedule_url: "https://fillout.com/reschedule/def",
        },
      ]}
    />
  </Frame>
);

// Un seul appel à venir.
export const Unique = () => (
  <Frame>
    <AnimatedUpcomingGrid
      calls={[
        {
          id: "1",
          date: "2026-06-22T14:00:00Z",
          host: "Théo",
          subject: "Revue de ton espace Notion client",
          status: "upcoming",
          reschedule_url: "https://fillout.com/reschedule/abc",
        },
      ]}
    />
  </Frame>
);
