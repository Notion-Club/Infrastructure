import type { Conversation } from "../types/conversation.types";
import { MOCK_USERS } from "./users.mock";

const salim = MOCK_USERS.find((u) => u.id === "salim")!;
const admin = MOCK_USERS.find((u) => u.id === "self-admin")!;
const noah = MOCK_USERS.find((u) => u.id === "noah")!;
const marie = MOCK_USERS.find((u) => u.id === "free-marie")!;
const deleted = MOCK_USERS.find((u) => u.id === "deleted-user")!;
const lucie = MOCK_USERS.find((u) => u.id === "lucie")!;

const SELF_ID = "self-paid"; // will be overridden by role

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-salim",
    participant: salim,
    unreadCount: 2,
    lastMessageAt: "2026-05-19T11:30:00Z",
    messages: [
      {
        id: "m1",
        senderId: "salim",
        type: "text",
        body: "Salut Théo ! Tu as une minute pour regarder mon nouveau template ?",
        reactions: [],
        createdAt: "2026-05-19T11:00:00Z",
      },
      {
        id: "m2",
        senderId: SELF_ID,
        type: "text",
        body: "Bien sûr ! Envoie-le moi.",
        reactions: [{ emoji: "👍", userId: "salim" }],
        createdAt: "2026-05-19T11:05:00Z",
      },
      {
        id: "m3",
        senderId: "salim",
        type: "pdf",
        body: "Template_Freelance_v2.pdf",
        fileName: "Template_Freelance_v2.pdf",
        fileUrl: "#",
        reactions: [],
        createdAt: "2026-05-19T11:10:00Z",
      },
      {
        id: "m4",
        senderId: "salim",
        type: "text",
        body: "C'est la v2 avec les vues filtrées qu'on avait discutées. Qu'est-ce que tu en penses ?",
        reactions: [],
        createdAt: "2026-05-19T11:12:00Z",
      },
      {
        id: "m5",
        senderId: SELF_ID,
        type: "text",
        body: "Super propre ! J'aime bien la vue par client. Une suggestion : tu pourrais ajouter une vue calendrier pour les deadlines.",
        reactions: [{ emoji: "❤️", userId: "salim" }],
        createdAt: "2026-05-19T11:20:00Z",
      },
      {
        id: "m6",
        senderId: "salim",
        type: "text",
        body: "Bonne idée ! Je le fais ce soir. Merci pour les retours comme toujours 🙌",
        reactions: [],
        createdAt: "2026-05-19T11:25:00Z",
      },
      {
        id: "m7",
        senderId: "salim",
        type: "text",
        body: "Au fait, tu savais que le template s'est vendu 3 fois de plus depuis hier ?",
        reactions: [],
        createdAt: "2026-05-19T11:28:00Z",
      },
      {
        id: "m8",
        senderId: "salim",
        type: "text",
        body: "On est à 8 ventes en 2 jours ! 🎉",
        reactions: [],
        createdAt: "2026-05-19T11:30:00Z",
      },
    ],
  },
  {
    id: "conv-admin",
    participant: admin,
    unreadCount: 0,
    lastMessageAt: "2026-05-18T09:00:00Z",
    messages: [
      {
        id: "am1",
        senderId: "self-admin",
        type: "text",
        body: "Bonjour ! Je voulais te féliciter pour ta progression dans la formation. Tu es dans le top 10% des membres les plus actifs.",
        reactions: [{ emoji: "🙏", userId: SELF_ID }],
        createdAt: "2026-05-17T10:00:00Z",
      },
      {
        id: "am2",
        senderId: SELF_ID,
        type: "text",
        body: "Merci beaucoup ! La formation est vraiment bien structurée. J'ai une question sur le module 8, les automatisations avancées...",
        reactions: [],
        createdAt: "2026-05-17T10:30:00Z",
      },
      {
        id: "am3",
        senderId: "self-admin",
        type: "text",
        body: "Bien sûr, pose ta question ! C'est un module dense mais très utile.",
        reactions: [],
        createdAt: "2026-05-17T11:00:00Z",
      },
      {
        id: "am4",
        senderId: SELF_ID,
        type: "text",
        body: "Comment tu gères les cas où Make échoue ? Tu as une stratégie de retry ?",
        reactions: [],
        createdAt: "2026-05-17T11:15:00Z",
      },
      {
        id: "am5",
        senderId: "self-admin",
        type: "text",
        body: "Excellente question ! Make a un système natif de retry. Tu peux configurer jusqu'à 3 tentatives avec un délai. Je te prépare un mini-guide là-dessus.",
        reactions: [{ emoji: "❤️", userId: SELF_ID }],
        createdAt: "2026-05-18T09:00:00Z",
      },
    ],
  },
  {
    id: "conv-noah",
    participant: noah,
    unreadCount: 1,
    lastMessageAt: "2026-05-16T14:00:00Z",
    messages: [
      {
        id: "nm1",
        senderId: SELF_ID,
        type: "text",
        body: "Bonjour Noah, j'aimerais planifier une session de coaching individuel si c'est possible.",
        reactions: [],
        createdAt: "2026-05-14T09:00:00Z",
      },
      {
        id: "nm2",
        senderId: "noah",
        type: "text",
        body: "Bonjour ! Avec plaisir. J'ai des créneaux disponibles la semaine prochaine. Tu préfères matin ou après-midi ?",
        reactions: [],
        createdAt: "2026-05-14T10:00:00Z",
      },
      {
        id: "nm3",
        senderId: SELF_ID,
        type: "text",
        body: "Après-midi de préférence, vers 15h ou 16h.",
        reactions: [],
        createdAt: "2026-05-14T10:30:00Z",
      },
      {
        id: "nm4",
        senderId: "noah",
        type: "text",
        body: "Parfait ! Je te réserve le jeudi 23 mai à 15h. Je t'envoie le lien Zoom par email.",
        reactions: [{ emoji: "👍", userId: SELF_ID }],
        createdAt: "2026-05-16T14:00:00Z",
      },
    ],
  },
  {
    id: "conv-lucie",
    participant: lucie,
    unreadCount: 0,
    lastMessageAt: "2026-05-12T16:30:00Z",
    messages: [
      {
        id: "lm1",
        senderId: SELF_ID,
        type: "text",
        body: "Salut Lucie ! J'ai vu ta question sur les rollups dans le feed. Tu as réussi à comprendre ?",
        reactions: [],
        createdAt: "2026-05-12T15:00:00Z",
      },
      {
        id: "lm2",
        senderId: "lucie",
        type: "text",
        body: "Oui ! Finalement Noah m'a expliqué en commentaire. C'est logique une fois qu'on comprend le principe des relations.",
        reactions: [],
        createdAt: "2026-05-12T16:00:00Z",
      },
      {
        id: "lm3",
        senderId: SELF_ID,
        type: "text",
        body: "Super ! N'hésite pas si tu as d'autres questions.",
        reactions: [{ emoji: "❤️", userId: "lucie" }],
        createdAt: "2026-05-12T16:30:00Z",
      },
    ],
  },
  {
    id: "conv-deleted",
    participant: deleted,
    unreadCount: 0,
    lastMessageAt: "2026-04-01T10:00:00Z",
    messages: [
      {
        id: "dm1",
        senderId: "deleted-user",
        type: "text",
        body: "Bonjour ! Je voulais te demander un conseil sur mon workspace.",
        reactions: [],
        createdAt: "2026-04-01T09:00:00Z",
      },
      {
        id: "dm2",
        senderId: SELF_ID,
        type: "text",
        body: "Bien sûr, dis-moi !",
        reactions: [],
        createdAt: "2026-04-01T10:00:00Z",
      },
    ],
  },
  {
    id: "conv-marie",
    participant: marie,
    unreadCount: 0,
    lastMessageAt: "2026-05-10T09:00:00Z",
    messages: [],
  },
];
