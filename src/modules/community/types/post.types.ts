import type { User } from "./user.types";

export type PostTag = "general" | "question" | "presentation" | "annonce";
export type PostAudience = "all" | "free_only" | "paid_only";

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
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
