import type { User } from "./user.types";

export type PostTag = "general" | "question" | "presentation" | "annonce";
export type PostAudience = "all" | "free_only" | "paid_only";

// Reactor inclus dans une réaction pour permettre l'affichage des vrais
// noms / avatars dans le hover popover et la bottom sheet (avant : tirage
// fictif depuis MOCK_USERS qui mentait sur l'auteur réel). Optionnel pour
// tolérer les sources legacy (mocks de dev) — quand absent, l'UI tombe
// sur un affichage neutre "1 personne / 2 personnes…".
export type Reactor = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  avatarColor: string | null;
};

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
  reactors?: Reactor[];
}

export interface Post {
  id: string;
  author: User;
  // Tier de l'auteur snapshoté au write (migration 020). Optionnel pour
  // tolérer les mocks legacy. Pour les posts venant de la DB, équivaut à
  // author.offer (dérivé via mapProfileToUser).
  authorTier?: "free" | "paid";
  tag: PostTag;
  audience: PostAudience;
  title?: string;
  body: string; // plain text, pre-formatted
  imageUrl?: string;
  videoUrl?: string;
  pinned: boolean;
  pinnedUntil?: string;
  reactions: Reaction[];
  commentCount: number;
  // Utilisateurs mentionnés via @nom (table post_mentions, mig. 020). Utilisé
  // par le helper de rendu pour colorer ces @nom en brand. Optionnel pour
  // tolérer les mocks legacy.
  mentions?: { id: string; name: string }[];
  createdAt: string;
  // Bumpé par le trigger DB à chaque UPDATE (cf. migration 014). À l'INSERT,
  // updatedAt = createdAt (les deux pointent vers now()), donc l'UI doit
  // comparer avec un seuil (>1s de delta) pour distinguer "vraiment édité"
  // vs "drift de trigger". Optionnel pour tolérer les sources legacy
  // (mocks) qui ne le renseignent pas.
  updatedAt?: string;
}

// Pagination keyset du feed. Le curseur porte le COUPLE (created_at, id) du
// dernier post d'une page : le tie-break sur `id` est indispensable car de
// nombreux posts importés partagent la même created_at (dates Slack au
// jour/heure près) — sans lui, des posts seraient sautés ou dupliqués entre
// pages. `createdAt` est la valeur timestamptz EXACTE renvoyée par la DB, à
// repasser telle quelle (ne pas la reformater, sinon l'égalité casse).
export interface PostCursor {
  createdAt: string;
  id: string;
}

export interface PostsPage {
  posts: Post[];
  nextCursor: PostCursor | null;
  hasMore: boolean;
}
