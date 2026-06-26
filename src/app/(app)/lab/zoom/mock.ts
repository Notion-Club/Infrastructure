// Données mockées pour le prototype de zoom-transition (Phase 1, dev-only).
// Aucune dépendance au module /ressources réel — DNA reproduite à la main.

export interface LabResource {
  slug: string;
  titre: string;
  description: string;
  /** Nom de formation (pill colorée "formation"). */
  formation: string;
  /** Type métier (pill "type"). */
  type: string;
  /** Date ISO — affichée dans l'encadré détail mocké. */
  dateCreation: string;
}

export const LAB_RESOURCES: LabResource[] = [
  {
    slug: 'systeme-crm-notion',
    titre: 'Construire un CRM complet sous Notion',
    description:
      'Un système de suivi commercial de bout en bout : pipeline, relances automatiques et tableau de bord temps réel.',
    formation: 'Notion Business',
    type: 'Relation Client',
    dateCreation: '2026-03-12',
  },
  {
    slug: 'dashboard-production',
    titre: 'Dashboard de production agence',
    description:
      'Centralise briefs, deadlines et capacité d’équipe dans une vue unique pour ne plus rien laisser passer.',
    formation: 'Notion Architecte',
    type: 'Production',
    dateCreation: '2026-02-28',
  },
  {
    slug: 'tunnel-acquisition',
    titre: 'Tunnel d’acquisition automatisé',
    description:
      'De la capture du lead à la qualification, un funnel Notion connecté à tes formulaires et relances.',
    formation: 'Notion Business',
    type: 'Acquisition',
    dateCreation: '2026-04-05',
  },
  {
    slug: 'process-sales',
    titre: 'Process de closing Sales',
    description:
      'Scripts, objections et étapes de signature structurés pour fiabiliser chaque rendez-vous de vente.',
    formation: 'Notion Business',
    type: 'Sales',
    dateCreation: '2026-01-19',
  },
  {
    slug: 'wiki-business',
    titre: 'Wiki d’entreprise scalable',
    description:
      'L’architecture documentaire qui grandit avec l’équipe : permissions, modèles et navigation claire.',
    formation: 'Notion Architecte',
    type: 'Business',
    dateCreation: '2026-03-30',
  },
  {
    slug: 'rediff-live-notion',
    titre: 'Rediffusion — masterclass Notion',
    description:
      'Le replay commenté de la session live, avec les templates utilisés et les questions de la communauté.',
    formation: 'Notion Architecte',
    type: 'Rediffusion de Live',
    dateCreation: '2026-04-22',
  },
];
