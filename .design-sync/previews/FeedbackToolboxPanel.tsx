import { FeedbackToolboxPanel } from "notionclub-infra";

const noop = () => {};

const drafts = [
  {
    id: "d1",
    element: "Bouton « Reprendre » · Formation",
    elementUrl: "https://app.notionclub.fr/formation#reprendre",
    action: "Changer une couleur",
    end: "Frontend",
    page: "Formation",
    text: "Le bouton rouge se confond avec le badge de progression juste à côté. Idéalement le passer en contour plutôt qu'en plein.",
    timestamp: "2026-06-18T09:12:00Z",
    isGeneral: false,
  },
  {
    id: "d2",
    element: "Page entière",
    elementUrl: "https://app.notionclub.fr/coaching",
    action: "",
    end: "",
    page: "Coaching",
    text: "Sur mobile, la pill « Ton prochain appel » passe sous la barre de navigation.",
    timestamp: "2026-06-18T09:20:00Z",
    isGeneral: true,
  },
];

const notionTickets = [
  {
    notionId: "n1",
    element: "Titre « Bon retour Théo » · Accueil",
    action: "Modifier du texte",
    page: "Accueil",
    text: "Remplacer « Bon retour » par « Content de te revoir » — ton plus chaleureux côté communauté.",
    status: "À traiter",
    statusColor: "#f59e0b",
    timestamp: "2026-06-16T14:00:00Z",
  },
  {
    notionId: "n2",
    element: "Carte « Communauté » · Accueil",
    action: "Modifier la mise en page",
    page: "Accueil",
    text: "Le placeholder dashed prend trop de place. À remplacer par une vraie carte aperçu du feed.",
    status: "En cours",
    statusColor: "#3b82f6",
    timestamp: "2026-06-14T10:30:00Z",
  },
  {
    notionId: "n3",
    element: "Champ Bio · Éditeur de profil",
    action: "Corriger une faute",
    page: "Réglages",
    text: "« Parle un peu de toi… » → garder, mais le compteur déborde à 280.",
    status: "Traité",
    statusColor: "#10b981",
    timestamp: "2026-06-10T08:00:00Z",
  },
];

const shared = {
  onElement: noop,
  onGeneral: noop,
  loadingTickets: false,
  ticketsError: null,
  deletingId: null,
  isSending: false,
  onEditDraft: noop,
  onDeleteDraft: noop,
  onSend: noop,
  onRefreshTickets: noop,
  onDeleteTicket: noop,
};

const shell = (children: React.ReactNode) => (
  <div
    style={{
      width: 320,
      padding: 10,
      background: "var(--color-surface-card)",
      border: "1px solid var(--color-border-default)",
      borderRadius: 16,
      boxShadow: "var(--nc-shadow-2)",
    }}
  >
    {children}
  </div>
);

export const Hub = () =>
  shell(
    <FeedbackToolboxPanel
      {...shared}
      drafts={drafts}
      notionTickets={notionTickets}
    />,
  );

export const EmptyTickets = () =>
  shell(
    <FeedbackToolboxPanel {...shared} drafts={[]} notionTickets={[]} />,
  );
