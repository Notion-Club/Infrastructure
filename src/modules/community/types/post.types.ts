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
  createdAt: string;
}
