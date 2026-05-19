import type { User } from "./user.types";
import type { Reaction } from "./post.types";

export interface CommentReply {
  id: string;
  author: User;
  body: string;
  mentionedUser?: User;
  reactions: Reaction[];
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  author: User;
  body: string;
  reactions: Reaction[];
  replies: CommentReply[];
  createdAt: string;
}
