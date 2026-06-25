export type NotificationType =
  | "mention_post"
  | "mention_comment"
  | "comment_on_post"
  | "reply_to_comment"
  | "reaction_on_post"
  | "new_dm"
  | "admin_annonce"
  // Push admin/système (mig. 044) : titre + lien libres, sans acteur.
  | "admin_push";

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
  /**
   * Titre libre — uniquement pour les push admin (type admin_push). Les notifs
   * community laissent ce champ vide (titre dérivé acteur + verbe côté UI).
   */
  title?: string;
  /**
   * Deep-link libre ouvert au tap — uniquement pour les push admin. Les notifs
   * community déduisent leur lien de postId / conversationId.
   */
  link?: string;
  read: boolean;
  createdAt: string;
}
