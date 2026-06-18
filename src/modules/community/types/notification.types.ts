export type NotificationType =
  | "mention_post"
  | "mention_comment"
  | "comment_on_post"
  | "reply_to_comment"
  | "reaction_on_post"
  | "new_dm"
  | "admin_annonce";

export interface Notification {
  id: string;
  type: NotificationType;
  /** Profil à l'origine de l'événement (qui a mentionné / commenté / réagi). */
  actorId: string;
  actorName: string;
  actorAvatar: string | null;
  /** Couleur d'avatar fallback (avatar_color), pour le rond initiales. */
  actorAvatarColor: string | null;
  actorInitials: string;
  excerpt: string;
  postId?: string;
  conversationId?: string;
  read: boolean;
  createdAt: string;
}
