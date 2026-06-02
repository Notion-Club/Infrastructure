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
  // Quote-reply (mig. 027). Trois colonnes dénormalisées qui survivent à
  // la suppression du message original.
  replyToMessageId?: string | null;
  replySnippet?: string | null;
  replyAuthorName?: string | null;
  // Forward (mig. 028). Snapshot du nom de l'auteur original pour le
  // badge "Transféré de [Nom]" — survit à la suppression du profil source.
  forwardedFromMessageId?: string | null;
  forwardedFromAuthorName?: string | null;
}

export interface Conversation {
  id: string;
  participant: User; // the other person (not the current user)
  messages: Message[];
  unreadCount: number;
  lastMessageAt: string;
  // Aperçu du dernier message (tronqué côté serveur à ~140 chars) + flag
  // "envoyé par moi" pour préfixer "Vous : …" dans la liste. Calculé dans
  // listConversations à partir de lightMessages — évite un fetch supplémentaire.
  lastMessagePreview?: string;
  lastMessageFromMe?: boolean;
  lastMessageType?: MessageType;
}
