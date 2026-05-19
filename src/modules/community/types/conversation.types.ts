import type { User } from "./user.types";

export type MessageType = "text" | "image" | "pdf";

export interface Message {
  id: string;
  senderId: string;
  type: MessageType;
  body: string;
  fileUrl?: string;
  fileName?: string;
  reactions: Array<{ emoji: string; userId: string }>;
  createdAt: string;
  editedAt?: string;
  deleted?: boolean;
}

export interface Conversation {
  id: string;
  participant: User; // the other person (not the current user)
  messages: Message[];
  unreadCount: number;
  lastMessageAt: string;
}
