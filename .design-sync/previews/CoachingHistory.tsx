import { CoachingHistory } from "notionclub-infra";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 760, background: "var(--color-surface-page)", padding: 24 }}>
    {children}
  </div>
);

const PAST = [
  {
    id: "2",
    date: "2026-05-15T14:00:00Z",
    host: "Théo",
    subject: "Mise en place du tracker d'objectifs",
    status: "accepted" as const,
    ai_summary:
      "Discussion sur la structure du tracker d'objectifs dans Notion. Mise en place d'une vue par trimestre et de relations avec la base des tâches. Next steps : créer les automations de rappel hebdomadaire.",
  },
  {
    id: "3",
    date: "2026-05-08T10:00:00Z",
    host: "Noah",
    subject: "Architecture de la base CRM",
    status: "accepted" as const,
    ai_summary:
      "Discussion approfondie sur la structure de la base CRM dans Notion. Recommandation d'utiliser une vue par tag pour faciliter le filtrage. Next steps : implémenter les automations Make pour la sync.",
  },
];

const UPCOMING = [
  {
    id: "1",
    date: "2026-06-22T14:00:00Z",
    host: "Théo",
    subject: "Aide setup CRM client",
    status: "upcoming" as const,
    reschedule_url: "https://fillout.com/reschedule/abc",
  },
];

// Switcher actif : onglet « appels passés » par défaut (grille de résumés).
export const VuePassee = () => (
  <Frame>
    <CoachingHistory pastCalls={PAST} upcomingCalls={UPCOMING} showUpcoming />
  </Frame>
);

// Bascule directe sur « à venir » via le nonce de focus.
export const VueAVenir = () => (
  <Frame>
    <CoachingHistory
      pastCalls={PAST}
      upcomingCalls={UPCOMING}
      showUpcoming
      focusUpcomingNonce={1}
    />
  </Frame>
);

// Pas d'appels à venir possibles : grille des passés seule, sans switcher.
export const SansSwitcher = () => (
  <Frame>
    <CoachingHistory pastCalls={PAST} upcomingCalls={[]} showUpcoming={false} />
  </Frame>
);

// Accompagnement expiré : tuiles atténuées.
export const Archive = () => (
  <Frame>
    <CoachingHistory
      pastCalls={PAST}
      upcomingCalls={[]}
      showUpcoming={false}
      archived
    />
  </Frame>
);
