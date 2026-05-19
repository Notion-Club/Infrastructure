import type { Comment } from "../types/comment.types";
import { MOCK_USERS } from "./users.mock";

const salim = MOCK_USERS.find((u) => u.id === "salim")!;
const lucie = MOCK_USERS.find((u) => u.id === "lucie")!;
const bergelie = MOCK_USERS.find((u) => u.id === "bergelie")!;
const marc = MOCK_USERS.find((u) => u.id === "marc-p")!;
const julie = MOCK_USERS.find((u) => u.id === "julie")!;
const noah = MOCK_USERS.find((u) => u.id === "noah")!;
const nathan = MOCK_USERS.find((u) => u.id === "nathan")!;
const admin = MOCK_USERS.find((u) => u.id === "self-admin")!;
const marie = MOCK_USERS.find((u) => u.id === "free-marie")!;
const jean = MOCK_USERS.find((u) => u.id === "free-jean")!;

export const MOCK_COMMENTS: Comment[] = [
  // Comments on post-3 (Salim victoire template)
  {
    id: "c1",
    postId: "post-3",
    author: lucie,
    body: "Félicitations Salim ! C'est une vraie victoire. Tu peux partager le lien Gumroad ?",
    reactions: [{ emoji: "❤️", count: 4, userReacted: false }],
    replies: [
      {
        id: "c1-r1",
        author: salim,
        mentionedUser: lucie,
        body: "@Lucie Bien sûr ! Je le partage en DM pour ne pas faire de pub ici 😄",
        reactions: [{ emoji: "❤️", count: 2, userReacted: false }],
        createdAt: "2026-05-19T09:00:00Z",
      },
      {
        id: "c1-r2",
        author: julie,
        mentionedUser: salim,
        body: "@Salim Super initiative, tu peux aussi me l'envoyer !",
        reactions: [],
        createdAt: "2026-05-19T09:30:00Z",
      },
    ],
    createdAt: "2026-05-19T08:45:00Z",
  },
  {
    id: "c2",
    postId: "post-3",
    author: noah,
    body: "Excellent travail ! Les vues filtrées par priorité font vraiment la différence pour les freelances. Tu as utilisé quelle formule pour le tri ?",
    reactions: [
      { emoji: "👏", count: 6, userReacted: false },
      { emoji: "💡", count: 3, userReacted: false },
    ],
    replies: [
      {
        id: "c2-r1",
        author: salim,
        mentionedUser: noah,
        body: "@Noah J'utilise une formule avec if(prop(\"Statut\") == \"Urgent\", 1, if(prop(\"Statut\") == \"En cours\", 2, 3)) — simple mais efficace !",
        reactions: [{ emoji: "🔥", count: 5, userReacted: true }],
        createdAt: "2026-05-19T10:00:00Z",
      },
    ],
    createdAt: "2026-05-19T09:15:00Z",
  },
  {
    id: "c3",
    postId: "post-3",
    author: admin,
    body: "Bravo Salim, tu es l'exemple parfait de ce qu'on construit ici. 200€ c'est un excellent prix pour un premier template. La prochaine étape : créer une offre bundle !",
    reactions: [
      { emoji: "❤️", count: 8, userReacted: false },
      { emoji: "🎉", count: 4, userReacted: false },
    ],
    replies: [],
    createdAt: "2026-05-19T11:00:00Z",
  },
  {
    id: "c4",
    postId: "post-3",
    author: bergelie,
    body: "Inspirant ! Ça me donne envie de finir mon template de gestion de projet. Tu as mis combien de temps à le construire ?",
    reactions: [{ emoji: "❤️", count: 2, userReacted: false }],
    replies: [],
    createdAt: "2026-05-19T12:00:00Z",
  },
  {
    id: "c5",
    postId: "post-3",
    author: marc,
    body: "Les templates Notion c'est vraiment un bon business model. J'ai quelques idées mais je me demande comment valider l'audience avant de créer le template.",
    reactions: [],
    replies: [
      {
        id: "c5-r1",
        author: noah,
        mentionedUser: marc,
        body: "@Marc La meilleure façon : poster une maquette dans la communauté et voir les réactions avant de tout construire. Lance un sondage !",
        reactions: [{ emoji: "💡", count: 7, userReacted: false }],
        createdAt: "2026-05-19T13:30:00Z",
      },
    ],
    createdAt: "2026-05-19T13:00:00Z",
  },

  // Comments on post-4 (Lucie question automatisation)
  {
    id: "c6",
    postId: "post-4",
    author: salim,
    body: "J'ai fait exactement ça ! Le trigger dans Make c'est \"New item in database\". Tu filtres sur le statut \"À relancer\" et c'est parti. Je peux faire un screen si tu veux.",
    reactions: [{ emoji: "❤️", count: 6, userReacted: false }],
    replies: [
      {
        id: "c6-r1",
        author: lucie,
        mentionedUser: salim,
        body: "@Salim Oui s'il te plaît, ça m'aiderait beaucoup !",
        reactions: [],
        createdAt: "2026-05-18T17:30:00Z",
      },
    ],
    createdAt: "2026-05-18T17:00:00Z",
  },
  {
    id: "c7",
    postId: "post-4",
    author: noah,
    body: "La combinaison Notion + Make + Gmail est vraiment puissante pour ça. Le trigger \"Page updated\" avec un filtre sur la date de relance fonctionne très bien.",
    reactions: [
      { emoji: "💡", count: 9, userReacted: true },
      { emoji: "❤️", count: 4, userReacted: false },
    ],
    replies: [],
    createdAt: "2026-05-18T18:00:00Z",
  },

  // Comments on pin-2 (planning sessions live)
  {
    id: "c8",
    postId: "pin-2",
    author: bergelie,
    body: "Hâte pour la session sur les automatisations ! Est-ce qu'on va aborder Zapier aussi ou juste Make ?",
    reactions: [{ emoji: "❤️", count: 3, userReacted: false }],
    replies: [
      {
        id: "c8-r1",
        author: nathan,
        mentionedUser: bergelie,
        body: "@Bergelie On se concentre sur Make pour cette session car c'est plus puissant, mais on mentionnera les alternatives.",
        reactions: [{ emoji: "👍", count: 5, userReacted: false }],
        createdAt: "2026-05-06T16:00:00Z",
      },
    ],
    createdAt: "2026-05-06T15:30:00Z",
  },
  {
    id: "c9",
    postId: "pin-2",
    author: julie,
    body: "Y a-t-il un replay pour ceux qui ne peuvent pas être là en direct ?",
    reactions: [],
    replies: [
      {
        id: "c9-r1",
        author: admin,
        mentionedUser: julie,
        body: "@Julie Oui, les replays sont disponibles dans la section Formation dans les 24h après la session.",
        reactions: [{ emoji: "❤️", count: 8, userReacted: false }],
        createdAt: "2026-05-06T17:30:00Z",
      },
    ],
    createdAt: "2026-05-06T17:00:00Z",
  },

  // Comments on post-15 (Salim retour 6 mois)
  {
    id: "c10",
    postId: "post-15",
    author: marc,
    body: "Super retour honnête ! La partie CRM avec \"quelques hacks\", tu peux détailler ? Je cherche justement à construire un CRM simple dans Notion.",
    reactions: [{ emoji: "❤️", count: 5, userReacted: false }],
    replies: [],
    createdAt: "2026-05-04T09:00:00Z",
  },
  {
    id: "c11",
    postId: "post-15",
    author: lucie,
    body: "Intéressant le retour sur le calendrier équipe. Vous avez trouvé comment synchroniser Notion et Google Cal finalement ?",
    reactions: [],
    replies: [],
    createdAt: "2026-05-04T10:00:00Z",
  },
  {
    id: "c12",
    postId: "post-15",
    author: bergelie,
    body: "Pour la compta je seconde. J'ai essayé pendant 2 mois mais les limitations de filtrage et de calcul m'ont fait revenir sur un tableur. Notion reste le meilleur pour tout le reste.",
    reactions: [{ emoji: "💯", count: 4, userReacted: false }],
    replies: [],
    createdAt: "2026-05-04T11:30:00Z",
  },

  // Comments on free posts
  {
    id: "c13",
    postId: "post-free-2",
    author: marie,
    body: "Bonne question ! En gros dans Notion, tout est une \"page\" et une \"base de données\" c'est une collection structurée de pages. La table c'est juste une des vues possibles de la base de données.",
    reactions: [{ emoji: "❤️", count: 3, userReacted: false }],
    replies: [],
    createdAt: "2026-05-18T14:00:00Z",
  },
  {
    id: "c14",
    postId: "post-free-2",
    author: admin,
    body: "Parfaite explication de Marie ! Pour compléter : une base de données peut s'afficher en Table, Kanban, Calendrier, Galerie ou Timeline selon ce qui est le plus utile pour ton cas.",
    reactions: [{ emoji: "💡", count: 6, userReacted: false }],
    replies: [],
    createdAt: "2026-05-18T14:30:00Z",
  },
];

export function getCommentsByPostId(postId: string): Comment[] {
  return MOCK_COMMENTS.filter((c) => c.postId === postId);
}
