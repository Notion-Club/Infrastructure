// Données mockées pour la maquette statique Formation.
//
// Tout est en dur — aucun fetch, aucun appel réseau. Quand Brique 2 sera
// branchée par Nathan, ces structures viendront de Supabase et le type
// Program ci-dessous restera identique.
//
// Conventions ID :
//   - Programmes :   prog_<slug>
//   - Modules :      mod_<programSlug>_<position>
//   - Leçons :       les_<programSlug>_<modulePosition>_<lessonPosition>
//   - Ressources :   res_<numéro> (pool partagé)

import type {
  Lesson,
  FormationModule,
  LessonResource,
  Program,
  UserProgress,
} from "../types";

// ─── Pool de ressources partagées ──────────────────────────────────────
//
// 15 ressources réutilisées entre les leçons. 2 d'entre elles (res_14,
// res_15) ont `cachedUrl: null` pour tester le cas "ressource supprimée"
// qui doit être masquée côté UI.

const RESOURCES: Record<string, LessonResource> = {
  res_01: {
    id: "res_01",
    cachedTitle: "Template Workspace Client",
    cachedDescription:
      "Le template Notion de base pour démarrer un workspace client en moins de 30 minutes.",
    cachedType: "Production",
    cachedFormation: "Notion Architecte",
    cachedUrl: "https://www.notion.so/templates/workspace-client-mock",
  },
  res_02: {
    id: "res_02",
    cachedTitle: "Checklist découverte client",
    cachedDescription:
      "21 questions à poser en call de découverte pour cadrer le besoin.",
    cachedType: "Relation Client",
    cachedFormation: "Notion Business",
    cachedUrl: "https://www.notion.so/templates/checklist-decouverte-mock",
  },
  res_03: {
    id: "res_03",
    cachedTitle: "Base CRM prospects",
    cachedDescription:
      "Structure de DB prospects avec vues par étape de pipeline.",
    cachedType: "Acquisition",
    cachedFormation: "Notion Business",
    cachedUrl: "https://www.notion.so/templates/crm-mock",
  },
  res_04: {
    id: "res_04",
    cachedTitle: "Guide tarification consultant",
    cachedDescription:
      "Comment fixer ses tarifs au démarrage (forfait vs TJM, abonnement).",
    cachedType: "Acquisition",
    cachedFormation: "Notion Business",
    cachedUrl: "https://www.notion.so/guides/pricing-mock",
  },
  res_05: {
    id: "res_05",
    cachedTitle: "Modèle de proposition commerciale",
    cachedDescription: "Template Notion pour ta proposition commerciale.",
    cachedType: "Relation Client",
    cachedFormation: "Notion Business",
    cachedUrl: "https://www.notion.so/templates/proposition-mock",
  },
  res_06: {
    id: "res_06",
    cachedTitle: "Système de wiki interne",
    cachedDescription:
      "Architecture d'un wiki Notion scalable pour entreprise.",
    cachedType: "Production",
    cachedFormation: "Notion Architecte",
    cachedUrl: "https://www.notion.so/templates/wiki-mock",
  },
  res_07: {
    id: "res_07",
    cachedTitle: "Formules Notion essentielles",
    cachedDescription: "Cheat sheet des 20 formules Notion les plus utilisées.",
    cachedType: "Production",
    cachedFormation: "Notion Architecte",
    cachedUrl: "https://www.notion.so/cheatsheets/formulas-mock",
  },
  res_08: {
    id: "res_08",
    cachedTitle: "Pack relations & rollups",
    cachedDescription:
      "Exemples concrets pour maîtriser relations et rollups dans Notion.",
    cachedType: "Production",
    cachedFormation: "Notion Architecte",
    cachedUrl: "https://www.notion.so/packs/relations-mock",
  },
  res_09: {
    id: "res_09",
    cachedTitle: "Audit Notion en 7 points",
    cachedDescription:
      "Grille d'audit à utiliser quand un client te montre son workspace.",
    cachedType: "Relation Client",
    cachedFormation: "Notion Architecte",
    cachedUrl: "https://www.notion.so/guides/audit-mock",
  },
  res_10: {
    id: "res_10",
    cachedTitle: "Pipeline commercial",
    cachedDescription: "Workflow Notion automatisé pour ton pipeline de vente.",
    cachedType: "Acquisition",
    cachedFormation: "Notion Business",
    cachedUrl: "https://www.notion.so/templates/pipeline-mock",
  },
  res_11: {
    id: "res_11",
    cachedTitle: "Guide du closing en consulting",
    cachedDescription: "Méthodologie pour transformer un lead en client.",
    cachedType: "Acquisition",
    cachedFormation: "Notion Business",
    cachedUrl: "https://www.notion.so/guides/closing-mock",
  },
  res_12: {
    id: "res_12",
    cachedTitle: "Template onboarding équipe",
    cachedDescription: "Workspace prêt à l'emploi pour onboarder une équipe.",
    cachedType: "Production",
    cachedFormation: "Notion Architecte",
    cachedUrl: "https://www.notion.so/templates/onboarding-team-mock",
  },
  res_13: {
    id: "res_13",
    cachedTitle: "Briques de bases de données",
    cachedDescription: "12 patterns de DB Notion réutilisables.",
    cachedType: "Production",
    cachedFormation: "Notion Architecte",
    cachedUrl: "https://www.notion.so/packs/db-bricks-mock",
  },
  // Volontairement supprimées (cachedUrl: null) — pour tester la règle
  // "ressource masquée si supprimée".
  res_14: {
    id: "res_14",
    cachedTitle: "Template Sprint Notion (archivé)",
    cachedDescription: "Ancien template, retiré du catalogue.",
    cachedType: "Production",
    cachedFormation: "Notion Architecte",
    cachedUrl: null,
  },
  res_15: {
    id: "res_15",
    cachedTitle: "Guide pricing v1 (archivé)",
    cachedDescription: "Version obsolète remplacée par res_04.",
    cachedType: "Acquisition",
    cachedFormation: "Notion Business",
    cachedUrl: null,
  },
};

function pick(ids: string[]): LessonResource[] {
  return ids.map((id) => RESOURCES[id]);
}

// ─── Helpers de construction ───────────────────────────────────────────

function lesson(
  programSlug: string,
  modulePosition: number,
  position: number,
  init: {
    slug: string;
    title: string;
    description: string;
    videoDurationSeconds: number;
    resourceIds?: string[];
    isSalesLesson?: boolean;
  },
): Lesson {
  const id = `les_${programSlug}_${modulePosition}_${position}`;
  return {
    id,
    slug: init.slug,
    title: init.title,
    description: init.description,
    videoUrl: `https://tella.tv/video/MOCK_${id}`,
    videoDurationSeconds: init.videoDurationSeconds,
    isSalesLesson: init.isSalesLesson ?? false,
    position,
    resources: pick(init.resourceIds ?? []),
  };
}

// ─── Programme 1 : Challenge Gratuit ───────────────────────────────────

const CHALLENGE_GRATUIT: Program = {
  id: "prog_challenge_gratuit",
  slug: "challenge-gratuit",
  name: "Challenge gratuit — 4 jours pour démarrer Notion",
  description:
    "Quatre journées pour poser les fondations d'un workspace Notion solide, comprendre la philosophie de l'outil et découvrir comment en faire un levier business.",
  requiredCapability: "can_access_challenge_program",
  accessMode: "open",
  modules: [
    {
      id: "mod_challenge_1",
      slug: "jour-1-fondations",
      name: "Jour 1 — Poser les fondations",
      description:
        "Comprendre la logique Notion et créer ton premier workspace propre.",
      section: null,
      accessMode: null,
      position: 1,
      lessons: [
        lesson("challenge", 1, 1, {
          slug: "philosophie-notion",
          title: "La philosophie Notion en 8 minutes",
          description:
            "Pourquoi Notion n'est pas un Doc, pas un Trello et surtout pas un Excel — et comment cette différence change ta manière de structurer.",
          videoDurationSeconds: 8 * 60,
          resourceIds: ["res_07"],
        }),
        lesson("challenge", 1, 2, {
          slug: "premiere-page",
          title: "Créer ta première page utile",
          description:
            "Atelier guidé pour produire ta première page Notion qui te servira vraiment.",
          videoDurationSeconds: 12 * 60,
          resourceIds: ["res_06"],
        }),
        lesson("challenge", 1, 3, {
          slug: "blocs-essentiels",
          title: "Les blocs essentiels à connaître",
          description:
            "Toggle, callout, colonne, divider — les briques que tu utiliseras tous les jours.",
          videoDurationSeconds: 9 * 60,
        }),
      ],
    },
    {
      id: "mod_challenge_2",
      slug: "jour-2-bases-de-donnees",
      name: "Jour 2 — Apprivoiser les bases de données",
      description:
        "La fonctionnalité la plus puissante de Notion, expliquée sans jargon.",
      section: null,
      accessMode: null,
      position: 2,
      lessons: [
        lesson("challenge", 2, 1, {
          slug: "creer-une-db",
          title: "Créer une base de données depuis zéro",
          description:
            "On part d'une page vide et on construit notre première DB.",
          videoDurationSeconds: 14 * 60,
          resourceIds: ["res_13"],
        }),
        lesson("challenge", 2, 2, {
          slug: "vues-multiples",
          title: "Vues multiples : table, board, calendar",
          description:
            "Une même DB, plusieurs façons de la regarder selon le contexte.",
          videoDurationSeconds: 11 * 60,
          resourceIds: ["res_08"],
        }),
      ],
    },
    {
      id: "mod_challenge_3",
      slug: "jour-3-monter-un-systeme",
      name: "Jour 3 — Monter ton premier système",
      description:
        "Connecter plusieurs DB pour automatiser un mini-process complet.",
      section: null,
      accessMode: null,
      position: 3,
      lessons: [
        lesson("challenge", 3, 1, {
          slug: "relations-rollups",
          title: "Relations et rollups expliqués",
          description:
            "Le moment où Notion devient un vrai outil de productivité.",
          videoDurationSeconds: 16 * 60,
          resourceIds: ["res_08"],
        }),
        lesson("challenge", 3, 2, {
          slug: "tableau-de-bord",
          title: "Ton premier tableau de bord",
          description: "Synthétiser plusieurs DB sur une page d'accueil.",
          videoDurationSeconds: 13 * 60,
          resourceIds: ["res_12"],
        }),
        lesson("challenge", 3, 3, {
          slug: "templates-de-pages",
          title: "Industrialiser avec des templates",
          description:
            "Créer des templates de pages réutilisables dans tes DB.",
          videoDurationSeconds: 10 * 60,
        }),
      ],
    },
    {
      id: "mod_challenge_4",
      slug: "jour-4-faire-de-notion-un-business",
      name: "Jour 4 — Et si tu en faisais un business ?",
      description:
        "Découvre comment des consultants Notion vivent de leur expertise et viens en discuter avec moi.",
      section: null,
      accessMode: null,
      position: 4,
      lessons: [
        lesson("challenge", 4, 1, {
          slug: "consultant-notion",
          title: "Devenir consultant Notion : ce que ça implique",
          description:
            "Le métier de consultant Notion en 2026 — opportunités, marché, premiers clients. Si ça te parle, on en discute en call.",
          videoDurationSeconds: 18 * 60,
          isSalesLesson: true,
          resourceIds: ["res_04", "res_11"],
        }),
      ],
    },
  ],
};

// ─── Programme 2 : Devenir consultant Notion ───────────────────────────

const DEVENIR_CONSULTANT: Program = {
  id: "prog_devenir_consultant_notion",
  slug: "devenir-consultant-notion",
  name: "Devenir consultant Notion",
  description:
    "Le programme complet pour transformer ton expertise Notion en activité de consulting rentable. Architecte (technique) + Business (acquisition, closing, opérations) — 120 jours d'accompagnement.",
  requiredCapability: "can_access_paid_programs",
  accessMode: "strict",
  modules: [
    // ── Section Architecte (6 modules) ────────────────────────────────
    {
      id: "mod_paid_1",
      slug: "fondations-architecte",
      name: "Module 1 — Fondations de l'architecte Notion",
      description:
        "Penser comme un architecte : modéliser un besoin métier en système Notion.",
      section: "architecte",
      accessMode: null,
      position: 1,
      lessons: [
        lesson("paid", 1, 1, {
          slug: "modeliser-besoin",
          title: "Leçon 1 — Modéliser un besoin métier",
          description:
            "De l'entretien client à la cartographie d'objets et de relations.",
          videoDurationSeconds: 22 * 60,
          resourceIds: ["res_09"],
        }),
        lesson("paid", 1, 2, {
          slug: "principes-architecturaux",
          title: "Leçon 2 — Les 5 principes d'une bonne architecture Notion",
          description:
            "Single source of truth, séparation données/vues, granularité — les invariants.",
          videoDurationSeconds: 18 * 60,
          resourceIds: ["res_06"],
        }),
        lesson("paid", 1, 3, {
          slug: "outils-prerequis",
          title: "Leçon 3 — Ta boîte à outils de consultant",
          description:
            "Templates, snippets, références — ce que tu dois préparer avant ton premier client.",
          videoDurationSeconds: 12 * 60,
          resourceIds: ["res_01", "res_07"],
        }),
      ],
    },
    {
      id: "mod_paid_2",
      slug: "bases-de-donnees-avancees",
      name: "Module 2 — Bases de données avancées",
      description:
        "Toutes les fonctionnalités DB Notion poussées dans leurs retranchements.",
      section: "architecte",
      accessMode: null,
      position: 2,
      lessons: [
        lesson("paid", 2, 1, {
          slug: "schema-relations",
          title: "Leçon 1 — Concevoir un schéma relationnel propre",
          description:
            "Cardinalité, sens des relations, pièges à éviter.",
          videoDurationSeconds: 24 * 60,
          resourceIds: ["res_08", "res_13"],
        }),
        lesson("paid", 2, 2, {
          slug: "rollups-avances",
          title: "Leçon 2 — Rollups avancés et formules dérivées",
          description:
            "Tout ce que tu peux dériver d'une relation, et comment.",
          videoDurationSeconds: 21 * 60,
          resourceIds: ["res_07"],
        }),
        lesson("paid", 2, 3, {
          slug: "vues-filtres-complexes",
          title: "Leçon 3 — Vues et filtres complexes",
          description: "Filtres composés, vues personnalisées par persona.",
          videoDurationSeconds: 16 * 60,
        }),
        lesson("paid", 2, 4, {
          slug: "synced-blocks",
          title: "Leçon 4 — Synced blocks et stratégies de partage",
          description: "Quand utiliser les synced blocks plutôt qu'une DB.",
          videoDurationSeconds: 13 * 60,
          resourceIds: ["res_14"],
        }),
      ],
    },
    {
      id: "mod_paid_3",
      slug: "wikis-et-documentation",
      name: "Module 3 — Wikis & documentation interne",
      description:
        "Bâtir un wiki Notion qui scale et que les équipes utilisent vraiment.",
      section: "architecte",
      accessMode: null,
      position: 3,
      lessons: [
        lesson("paid", 3, 1, {
          slug: "anatomie-wiki",
          title: "Leçon 1 — Anatomie d'un wiki qui marche",
          description: "Les 4 zones d'un wiki Notion bien conçu.",
          videoDurationSeconds: 19 * 60,
          resourceIds: ["res_06"],
        }),
        lesson("paid", 3, 2, {
          slug: "permissions-strategie",
          title: "Leçon 2 — Stratégie de permissions",
          description: "Espaces, teamspaces, partage granulaire.",
          videoDurationSeconds: 15 * 60,
        }),
        lesson("paid", 3, 3, {
          slug: "maintenance-wiki",
          title: "Leçon 3 — Maintenir le wiki dans le temps",
          description: "Routines de mise à jour et review trimestrielle.",
          videoDurationSeconds: 11 * 60,
        }),
      ],
    },
    {
      id: "mod_paid_4",
      slug: "operations-et-process",
      name: "Module 4 — Opérations et process clients",
      description: "Modéliser des process opérationnels dans Notion.",
      section: "architecte",
      accessMode: null,
      position: 4,
      lessons: [
        lesson("paid", 4, 1, {
          slug: "pipeline-process",
          title: "Leçon 1 — Représenter un pipeline de process",
          description:
            "Status, étapes, transitions — les patterns reproductibles.",
          videoDurationSeconds: 20 * 60,
          resourceIds: ["res_10"],
        }),
        lesson("paid", 4, 2, {
          slug: "automatisations-natives",
          title: "Leçon 2 — Automatisations natives Notion",
          description: "Boutons, automations DB, formules réactives.",
          videoDurationSeconds: 17 * 60,
        }),
        lesson("paid", 4, 3, {
          slug: "integrations-zapier-make",
          title: "Leçon 3 — Intégrations Zapier / Make",
          description: "Quand sortir de Notion et comment le faire proprement.",
          videoDurationSeconds: 22 * 60,
        }),
        lesson("paid", 4, 4, {
          slug: "monitoring-process",
          title: "Leçon 4 — Monitorer la santé d'un process",
          description: "Tableaux de bord opérationnels pour le client.",
          videoDurationSeconds: 14 * 60,
          resourceIds: ["res_12"],
        }),
        lesson("paid", 4, 5, {
          slug: "documentation-process",
          title: "Leçon 5 — Documenter un process pour livraison",
          description:
            "Le livrable de documentation que tu remets en fin de mission.",
          videoDurationSeconds: 12 * 60,
        }),
      ],
    },
    {
      id: "mod_paid_5",
      slug: "workspaces-equipes",
      name: "Module 5 — Workspaces équipes & onboarding",
      description: "Concevoir un workspace partagé qui est adopté.",
      section: "architecte",
      accessMode: null,
      position: 5,
      lessons: [
        lesson("paid", 5, 1, {
          slug: "onboarding-equipe",
          title: "Leçon 1 — Onboarder une équipe sur Notion",
          description: "Le parcours d'adoption en 4 semaines.",
          videoDurationSeconds: 25 * 60,
          resourceIds: ["res_12"],
        }),
        lesson("paid", 5, 2, {
          slug: "conventions-equipe",
          title: "Leçon 2 — Conventions de nommage et de structure",
          description: "Comment éviter le chaos après 6 mois d'usage.",
          videoDurationSeconds: 13 * 60,
        }),
        lesson("paid", 5, 3, {
          slug: "formation-equipe",
          title: "Leçon 3 — Former l'équipe interne du client",
          description: "Transférer la compétence pour ne pas créer de dépendance.",
          videoDurationSeconds: 18 * 60,
        }),
      ],
    },
    {
      id: "mod_paid_6",
      slug: "audit-et-refactoring",
      name: "Module 6 — Audit et refactoring de workspaces",
      description:
        "Reprendre un workspace existant et le remettre d'aplomb sans tout casser.",
      section: "architecte",
      accessMode: null,
      position: 6,
      lessons: [
        lesson("paid", 6, 1, {
          slug: "methode-audit",
          title: "Leçon 1 — Méthode d'audit en 7 points",
          description: "Le framework que je déroule sur chaque audit.",
          videoDurationSeconds: 21 * 60,
          resourceIds: ["res_09"],
        }),
        lesson("paid", 6, 2, {
          slug: "plan-refactoring",
          title: "Leçon 2 — Construire un plan de refactoring",
          description: "Prioriser les chantiers, estimer le coût, communiquer.",
          videoDurationSeconds: 19 * 60,
        }),
        lesson("paid", 6, 3, {
          slug: "migration-sans-perte",
          title: "Leçon 3 — Migrer des données sans perte",
          description: "Stratégies de migration de DB et d'archivage.",
          videoDurationSeconds: 23 * 60,
        }),
        lesson("paid", 6, 4, {
          slug: "livrable-audit",
          title: "Leçon 4 — Le livrable d'audit",
          description: "Template du document que tu remets après audit.",
          videoDurationSeconds: 15 * 60,
        }),
      ],
    },
    // ── Section Business (5 modules) ──────────────────────────────────
    {
      id: "mod_paid_7",
      slug: "positionnement-offre",
      name: "Module 7 — Positionnement et offre",
      description:
        "Définir ton offre de consultant Notion : qui tu sers, comment, à quel prix.",
      section: "business",
      accessMode: null,
      position: 7,
      lessons: [
        lesson("paid", 7, 1, {
          slug: "choisir-niche",
          title: "Leçon 1 — Choisir une niche qui paie",
          description: "Les niches porteuses en 2026 et comment les valider.",
          videoDurationSeconds: 20 * 60,
        }),
        lesson("paid", 7, 2, {
          slug: "construire-offre",
          title: "Leçon 2 — Construire une offre claire",
          description:
            "Promesse, livrable, durée, prix — le canevas que j'utilise.",
          videoDurationSeconds: 17 * 60,
          resourceIds: ["res_04"],
        }),
        lesson("paid", 7, 3, {
          slug: "pricing-strategie",
          title: "Leçon 3 — Stratégie de pricing",
          description: "TJM, forfait, abonnement — quand choisir quoi.",
          videoDurationSeconds: 22 * 60,
          resourceIds: ["res_04", "res_15"],
        }),
        lesson("paid", 7, 4, {
          slug: "pitch-elevator",
          title: "Leçon 4 — Pitcher ton offre en 30 secondes",
          description: "L'exercice du pitch synthétique.",
          videoDurationSeconds: 11 * 60,
        }),
      ],
    },
    {
      id: "mod_paid_8",
      slug: "acquisition-clients",
      name: "Module 8 — Acquisition clients",
      description: "Trouver tes premiers clients sans budget pub.",
      section: "business",
      accessMode: null,
      position: 8,
      lessons: [
        lesson("paid", 8, 1, {
          slug: "linkedin-consultant",
          title: "Leçon 1 — LinkedIn pour le consultant Notion",
          description: "Profil, contenu, prospection — la stratégie complète.",
          videoDurationSeconds: 26 * 60,
        }),
        lesson("paid", 8, 2, {
          slug: "cold-outbound",
          title: "Leçon 2 — Prospection à froid qui ne soûle pas",
          description: "Templates de messages, ciblage, cadences.",
          videoDurationSeconds: 19 * 60,
          resourceIds: ["res_03"],
        }),
        lesson("paid", 8, 3, {
          slug: "reseaux-existants",
          title: "Leçon 3 — Activer ton réseau existant",
          description: "Le canal sous-estimé : tes anciens collègues et amis.",
          videoDurationSeconds: 14 * 60,
        }),
        lesson("paid", 8, 4, {
          slug: "marketplaces",
          title: "Leçon 4 — Marketplaces et plateformes",
          description: "Malt, Comet, Crème — où aller, où ne pas aller.",
          videoDurationSeconds: 13 * 60,
        }),
      ],
    },
    {
      id: "mod_paid_9",
      slug: "decouverte-et-cadrage",
      name: "Module 9 — Découverte et cadrage client",
      description: "Le moment qui décide si la mission va bien se passer.",
      section: "business",
      accessMode: null,
      position: 9,
      lessons: [
        lesson("paid", 9, 1, {
          slug: "call-decouverte",
          title: "Leçon 1 — Mener un call de découverte qui qualifie",
          description: "Les questions qui font la différence.",
          videoDurationSeconds: 23 * 60,
          resourceIds: ["res_02"],
        }),
        lesson("paid", 9, 2, {
          slug: "redaction-proposition",
          title: "Leçon 2 — Rédiger une proposition gagnante",
          description: "Structure, ton, prix — ce qui fait signer.",
          videoDurationSeconds: 18 * 60,
          resourceIds: ["res_05"],
        }),
        lesson("paid", 9, 3, {
          slug: "negociation",
          title: "Leçon 3 — Négocier sans brader",
          description: "Les techniques de négociation appliquées au consulting.",
          videoDurationSeconds: 16 * 60,
        }),
      ],
    },
    {
      id: "mod_paid_10",
      slug: "closing-et-onboarding-client",
      name: "Module 10 — Closing et démarrage de mission",
      description: "Transformer le oui en mission qui démarre bien.",
      section: "business",
      accessMode: null,
      position: 10,
      lessons: [
        lesson("paid", 10, 1, {
          slug: "closing-techniques",
          title: "Leçon 1 — Techniques de closing en consulting",
          description: "Lever les dernières objections proprement.",
          videoDurationSeconds: 17 * 60,
          resourceIds: ["res_11"],
        }),
        lesson("paid", 10, 2, {
          slug: "contrat-acompte",
          title: "Leçon 2 — Contrat et acompte",
          description:
            "Templates de contrat, gestion de l'acompte, points légaux.",
          videoDurationSeconds: 14 * 60,
        }),
      ],
    },
    {
      id: "mod_paid_11",
      slug: "delivery-et-fidelisation",
      name: "Module 11 — Delivery et fidélisation",
      description: "Livrer une mission qui crée de la récurrence.",
      section: "business",
      accessMode: null,
      position: 11,
      lessons: [
        lesson("paid", 11, 1, {
          slug: "kickoff-mission",
          title: "Leçon 1 — Réussir le kickoff de mission",
          description: "Cadrer les attentes la première semaine.",
          videoDurationSeconds: 15 * 60,
        }),
        lesson("paid", 11, 2, {
          slug: "rituels-mission",
          title: "Leçon 2 — Les rituels de mission qui rassurent",
          description: "Hebdo, comité de pilotage, reporting.",
          videoDurationSeconds: 13 * 60,
        }),
        lesson("paid", 11, 3, {
          slug: "upsell-recurrence",
          title: "Leçon 3 — Upsell et récurrence",
          description: "Transformer un client one-shot en récurrent.",
          videoDurationSeconds: 18 * 60,
        }),
      ],
    },
  ],
};

export const MOCK_PROGRAMS: Program[] = [DEVENIR_CONSULTANT, CHALLENGE_GRATUIT];

export const MOCK_PROGRAMS_BY_SLUG: Record<string, Program> = Object.fromEntries(
  MOCK_PROGRAMS.map((p) => [p.slug, p]),
);

// ─── Utilitaires d'accès aux mocks ─────────────────────────────────────

export function getAllLessonsOrdered(program: Program): Lesson[] {
  return program.modules
    .slice()
    .sort((a, b) => a.position - b.position)
    .flatMap((m) =>
      m.lessons.slice().sort((a, b) => a.position - b.position),
    );
}

export function findLessonByPath(
  programSlug: string,
  moduleSlug: string,
  lessonSlug: string,
): { program: Program; module: FormationModule; lesson: Lesson } | null {
  const program = MOCK_PROGRAMS_BY_SLUG[programSlug];
  if (!program) return null;
  const mod = program.modules.find((m) => m.slug === moduleSlug);
  if (!mod) return null;
  const les = mod.lessons.find((l) => l.slug === lessonSlug);
  if (!les) return null;
  return { program, module: mod, lesson: les };
}

// ─── Identité mock (sales lesson CTA) ──────────────────────────────────

export const MOCK_MEMBER = {
  memberId: "159bad05-6a95-80aa-bc8a-d6e0f8b9c1a2",
  email: "theo@notionclub.fr",
};

// ─── Progression utilisateur initiale (vide) ───────────────────────────
//
// Le toggle dev pourra peupler cet objet à la volée en fonction du niveau
// de progression sélectionné — voir useFormationProgress.

export const EMPTY_PROGRESS: UserProgress = {
  completedLessonIds: [],
  lessonNotes: {},
  lastAccessedLessonId: null,
};
