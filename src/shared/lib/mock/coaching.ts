export type CallStatus = "accepted" | "no_show" | "upcoming";

export interface MockCall {
  id: string;
  date: string; // ISO
  host: "Théo" | "Noah";
  subject: string;
  status: CallStatus;
  ai_summary?: string; // absent si upcoming
}

export const MOCK_UPCOMING_CALLS: MockCall[] = [
  {
    id: "1",
    date: "2026-05-21T14:00:00Z",
    host: "Théo",
    subject: "Aide setup CRM client",
    status: "upcoming",
  },
];

export const MOCK_PAST_CALLS: MockCall[] = [
  {
    id: "2",
    date: "2026-05-15T14:00:00Z",
    host: "Théo",
    subject: "Mise en place du tracker d'objectifs",
    status: "accepted",
    ai_summary:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  },
  {
    id: "3",
    date: "2026-05-08T10:00:00Z",
    host: "Noah",
    subject: "Architecture de la base CRM",
    status: "accepted",
    ai_summary:
      "Discussion approfondie sur la structure de la base CRM dans Notion. Recommandation d'utiliser une vue par tag pour faciliter le filtrage. Next steps : implémenter les automations Make pour la sync.",
  },
  {
    id: "4",
    date: "2026-05-01T14:00:00Z",
    host: "Théo",
    subject: "Stratégie de pricing",
    status: "no_show",
  },
];

// 5 calls pour l'état Accompagnement expiré
export const MOCK_EXPIRED_PAST_CALLS: MockCall[] = [
  ...MOCK_PAST_CALLS,
  {
    id: "5",
    date: "2026-04-24T16:00:00Z",
    host: "Noah",
    subject: "Review offre de service",
    status: "accepted",
    ai_summary:
      "Discussion sur le positionnement de l'offre et la structure du pricing. Noah recommande de simplifier les packages et de mettre en avant le ROI client plutôt que les fonctionnalités techniques.",
  },
  {
    id: "6",
    date: "2026-04-17T14:00:00Z",
    host: "Théo",
    subject: "Automatisation workflow client",
    status: "accepted",
    ai_summary:
      "Conception d'un workflow d'onboarding client automatisé avec Make et Notion. Points couverts : création automatique de l'espace client, envoi des accès, suivi de progression.",
  },
];

export type UserState =
  | "free"
  | "formation_0_calls"
  | "formation_1_call"
  | "accompagnement_eligible"
  | "accompagnement_not_eligible"
  | "accompagnement_expired";

export const STATE_LABELS: Record<UserState, string> = {
  free: "Challenge Gratuit",
  formation_0_calls: "Formation (0 call)",
  formation_1_call: "Formation (1 call fait)",
  accompagnement_eligible: "Accompagnement éligible",
  accompagnement_not_eligible: "Accompagnement non éligible",
  accompagnement_expired: "Accompagnement expiré",
};
