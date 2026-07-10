export type CallStatus = "accepted" | "no_show" | "upcoming";

export interface MockCall {
  id: string;
  date: string; // ISO
  host: "Théo" | "Noah";
  subject: string;
  status: CallStatus;
  ai_summary?: string; // absent si upcoming
}

// Type accepté par CallCard / UpcomingCallsSection / PastCallsSection. C'est
// le sur-ensemble qui couvre à la fois les mocks Théo (DevStateSwitcher) et
// les vraies données Notion. Les champs Notion sont optionnels — non présents
// sur les mocks, et déclenchent l'affichage du bouton transcription dans
// CallCard lorsqu'ils existent.
export interface CallCardData {
  id: string;
  date: string;
  host: string; // élargi (string au lieu de "Théo"|"Noah") pour accepter Notion brut
  host_avatar_url?: string; // photo de profil Notion du Host (people)
  subject: string;
  status: CallStatus;
  ai_summary?: string;
  notion_page_id?: string; // = id de la page Notion, sert au fetch transcription
  fathom_url?: string; // = lien Fathom externe
  // URL Notion "Reschedule URL" (Fillout / TidyCal) — bouton replanifier /
  // annuler sur les appels à venir. Absente sur les mocks / past calls.
  reschedule_url?: string;
  // URL signée vers /transcript/<token> (24h de validité).
  // Embarquée dans les boutons "Demander à ChatGPT/Claude" — l'IA suit le
  // lien et lit la transcription brute. Présente uniquement pour les past
  // calls liés à Notion ; absente sur les mocks et upcoming.
  transcript_url?: string;
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
