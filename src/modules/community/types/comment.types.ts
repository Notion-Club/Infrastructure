import type { User } from "./user.types";
import type { Reaction } from "./post.types";

export interface CommentReply {
  id: string;
  author: User;
  body: string;
  // Legacy singleton (comment_replies.mentioned_user_id). Conservé pour
  // compatibilité — la nouvelle source de vérité est `mentions[]` (mig. 022).
  mentionedUser?: User;
  // Utilisateurs mentionnés via @nom (table comment_reply_mentions, mig. 022).
  // Optionnel pour tolérer les mocks legacy.
  mentions?: { id: string; name: string }[];
  reactions: Reaction[];
  createdAt: string;
  // Optionnel pour tolérer les mocks legacy. Bumpé par trigger DB.
  updatedAt?: string;
}

export interface Comment {
  id: string;
  postId: string;
  author: User;
  body: string;
  reactions: Reaction[];
  replies: CommentReply[];
  // Utilisateurs mentionnés via @nom (table comment_mentions, mig. 020).
  // Utilisé par le helper de rendu pour colorer ces @nom en brand. Optionnel
  // pour tolérer les mocks legacy.
  mentions?: { id: string; name: string }[];
  createdAt: string;
  // Optionnel pour tolérer les mocks legacy. Bumpé par trigger DB.
  updatedAt?: string;
}
