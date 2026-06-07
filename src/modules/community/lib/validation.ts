import { z } from "zod";

// ============================================================================
// Constantes partagées — source unique de vérité côté app
// ============================================================================
// Doivent matcher les `check` côté DB (migration 014).
export const POST_TAGS = [
  "general",
  "question",
  "presentation",
  "annonce",
] as const;

export const POST_AUDIENCES = ["all", "free_only", "paid_only"] as const;

export type PostTag = (typeof POST_TAGS)[number];
export type PostAudience = (typeof POST_AUDIENCES)[number];

// ============================================================================
// Limites éditoriales
// ============================================================================
export const POST_TITLE_MIN = 3;
export const POST_TITLE_MAX = 200;
export const POST_BODY_MIN = 1;
export const POST_BODY_MAX = 8000;
export const COMMENT_BODY_MIN = 1;
export const COMMENT_BODY_MAX = 4000;

// ============================================================================
// createPost — input du composer
// ============================================================================
export const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(POST_TITLE_MIN, `Le titre doit faire au moins ${POST_TITLE_MIN} caractères`)
    .max(POST_TITLE_MAX, `${POST_TITLE_MAX} caractères maximum`),
  body: z
    .string()
    .trim()
    .min(POST_BODY_MIN, "Le contenu du post est requis")
    .max(POST_BODY_MAX, `${POST_BODY_MAX} caractères maximum`),
  tag: z.enum(POST_TAGS),
  audience: z.enum(POST_AUDIENCES),
  pinned: z.boolean().default(false),
  pinned_until: z
    .string()
    .datetime({ message: "Date d'épinglage invalide" })
    .nullable()
    .optional(),
  image_url: z.string().url().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
  // UUIDs des utilisateurs mentionnés (alimente la table post_mentions
  // créée par la migration 020). Optionnel.
  mention_ids: z.array(z.string().uuid()).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// Update partiel : tous les champs optionnels
export const updatePostSchema = createPostSchema.partial();
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// ============================================================================
// Commentaires — body uniquement (l'auteur vient de la session)
// ============================================================================
export const createCommentSchema = z.object({
  post_id: z.string().uuid({ message: "Post ID invalide" }),
  body: z
    .string()
    .trim()
    .min(COMMENT_BODY_MIN, "Le contenu du commentaire est requis")
    .max(COMMENT_BODY_MAX, `${COMMENT_BODY_MAX} caractères maximum`),
  // UUIDs des utilisateurs mentionnés (alimente la table comment_mentions
  // créée par la migration 020). Optionnel — vide si le commentaire ne
  // contient pas de @mention.
  mention_ids: z.array(z.string().uuid()).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// Update : seul le body est modifiable (changer l'auteur ou le post serait
// une faille d'intégrité). Le timestamp updated_at est bumpé par le trigger.
export const updateCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(COMMENT_BODY_MIN, "Le contenu du commentaire est requis")
    .max(COMMENT_BODY_MAX, `${COMMENT_BODY_MAX} caractères maximum`),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// ============================================================================
// Replies — réponses imbriquées à un commentaire (table comment_replies, mig. 014)
// ============================================================================
// L'auteur vient de la session (RLS comment_replies_insert_self) ; on valide
// uniquement le comment_id parent, le body et la mention optionnelle. Le
// mentioned_user_id est nullable côté DB (FK ON DELETE SET NULL) → on accepte
// null ou undefined pour ne pas forcer le client à envoyer la clé.
export const createCommentReplySchema = z.object({
  comment_id: z.string().uuid({ message: "Comment ID invalide" }),
  body: z
    .string()
    .trim()
    .min(COMMENT_BODY_MIN, "Le contenu de la réponse est requis")
    .max(COMMENT_BODY_MAX, `${COMMENT_BODY_MAX} caractères maximum`),
  // Legacy singleton (comment_replies.mentioned_user_id). Maintenant
  // redondant avec mention_ids ci-dessous, mais conservé pour rétro-compat.
  // Côté client : envoie le 1er id de mention_ids ici aussi.
  mentioned_user_id: z
    .string()
    .uuid({ message: "Utilisateur mentionné invalide" })
    .nullable()
    .optional(),
  // UUIDs des utilisateurs mentionnés (alimente la table comment_reply_mentions
  // créée par la migration 022). Permet N mentions par reply, contrairement
  // au singleton legacy ci-dessus.
  mention_ids: z.array(z.string().uuid()).optional(),
});
export type CreateCommentReplyInput = z.infer<typeof createCommentReplySchema>;

// Update : seul le body est modifiable. Trigger DB bump updated_at.
export const updateCommentReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(COMMENT_BODY_MIN, "Le contenu de la réponse est requis")
    .max(COMMENT_BODY_MAX, `${COMMENT_BODY_MAX} caractères maximum`),
});
export type UpdateCommentReplyInput = z.infer<typeof updateCommentReplySchema>;

// ============================================================================
// Reactions — toggle (post / comment)
// ============================================================================
// On valide juste l'emoji (1-4 chars, suffisant pour un emoji unicode même
// composé). PK composite côté DB garantit l'unicité (user, parent, emoji).
const emojiSchema = z
  .string()
  .min(1, "Emoji invalide")
  .max(8, "Emoji invalide");

export const togglePostReactionSchema = z.object({
  post_id: z.string().uuid(),
  emoji: emojiSchema,
});
export type TogglePostReactionInput = z.infer<typeof togglePostReactionSchema>;

export const toggleCommentReactionSchema = z.object({
  comment_id: z.string().uuid(),
  emoji: emojiSchema,
});
export type ToggleCommentReactionInput = z.infer<
  typeof toggleCommentReactionSchema
>;

// Reaction sur un reply — table comment_reply_reactions (migration 020).
// Symétrique de toggleCommentReactionSchema mais sur la table dédiée aux
// réponses ; permet aux membres de réagir aux replies imbriqués.
export const toggleCommentReplyReactionSchema = z.object({
  comment_reply_id: z.string().uuid(),
  emoji: emojiSchema,
});
export type ToggleCommentReplyReactionInput = z.infer<
  typeof toggleCommentReplyReactionSchema
>;

// ============================================================================
// DM — Direct Messages (table conversations + messages, mig. 014)
// ============================================================================
// Limites éditoriales : un message DM est plus court qu'un post mais plus
// long qu'un commentaire (chat fluide). 4000 cars suffit largement.
export const MESSAGE_BODY_MIN = 1;
export const MESSAGE_BODY_MAX = 4000;
export const MESSAGE_TYPES = ["text", "image", "pdf"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

// Création d'une conversation : l'autre participant uniquement. Le caller
// est forcément l'un des deux côté serveur (auth.uid).
export const createConversationSchema = z.object({
  target_user_id: z.string().uuid({ message: "Utilisateur invalide" }),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

// Snippet figé du message cité dans un quote-reply (mig. 027). 280 chars
// matche l'expérience tweet — assez pour donner le contexte sans surcharger
// la bulle. Le composer tronque côté client puis le serveur retrim.
export const REPLY_SNIPPET_MAX = 280;

// Envoi d'un message : conv + body (+ type/fichier si non-text).
export const sendMessageSchema = z
  .object({
    conversation_id: z.string().uuid({ message: "Conversation invalide" }),
    type: z.enum(MESSAGE_TYPES).default("text"),
    body: z
      .string()
      .trim()
      .max(MESSAGE_BODY_MAX, `${MESSAGE_BODY_MAX} caractères maximum`),
    file_url: z.string().url().nullable().optional(),
    file_name: z.string().max(256).nullable().optional(),
    // Quote-reply (mig. 027). Les 3 colonnes vont par paire — la contrainte
    // DB messages_quote_reply_consistency rejette les états partiels.
    reply_to_message_id: z.string().uuid().nullable().optional(),
    reply_snippet: z.string().trim().max(REPLY_SNIPPET_MAX).nullable().optional(),
    reply_author_name: z.string().trim().max(120).nullable().optional(),
  })
  .refine(
    (d) => d.type !== "text" || d.body.length >= MESSAGE_BODY_MIN,
    { message: "Le message ne peut pas être vide", path: ["body"] },
  )
  .refine(
    (d) => d.type === "text" || !!d.file_url,
    { message: "Fichier requis pour ce type de message", path: ["file_url"] },
  )
  .refine(
    // Si reply_to_message_id est fourni, snippet + author_name doivent l'être.
    // Symétrique de la contrainte DB messages_quote_reply_consistency.
    (d) =>
      !d.reply_to_message_id ||
      (!!d.reply_snippet && !!d.reply_author_name),
    { message: "Quote-reply incomplet", path: ["reply_to_message_id"] },
  );
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Édition d'un message texte. RLS messages_update_self (mig. 014) limite
// aux messages de l'auteur. Trigger DB messages_set_edited_at bump edited_at.
export const editMessageSchema = z.object({
  message_id: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(MESSAGE_BODY_MIN, "Le message ne peut pas être vide")
    .max(MESSAGE_BODY_MAX, `${MESSAGE_BODY_MAX} caractères maximum`),
});
export type EditMessageInput = z.infer<typeof editMessageSchema>;

// Suppression soft d'un message (deleted=true). RLS messages_update_self
// gère l'autorisation.
export const deleteMessageSchema = z.object({
  message_id: z.string().uuid(),
});
export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;

// Toggle réaction sur message (mig. 014, table message_reactions).
export const toggleMessageReactionSchema = z.object({
  message_id: z.string().uuid(),
  emoji: z.string().trim().min(1).max(16),
});
export type ToggleMessageReactionInput = z.infer<typeof toggleMessageReactionSchema>;

// Transfert d'un message à 1-5 destinataires. Le serveur crée/réutilise une
// conversation par target via createConversationAction puis envoie une copie.
// La copie porte forwarded_from_message_id + forwarded_from_author_name
// (mig. 028) pour afficher "Transféré de [Nom]".
export const FORWARD_MAX_TARGETS = 5;
export const forwardMessageSchema = z.object({
  message_id: z.string().uuid(),
  target_user_ids: z
    .array(z.string().uuid())
    .min(1, "Choisis au moins un destinataire")
    .max(FORWARD_MAX_TARGETS, `Maximum ${FORWARD_MAX_TARGETS} destinataires`),
});
export type ForwardMessageInput = z.infer<typeof forwardMessageSchema>;

// Marquer une conversation comme lue : juste l'id de la conv. Le serveur
// résout quel last_read_X_at bump selon l'identité du caller.
export const markConversationReadSchema = z.object({
  conversation_id: z.string().uuid(),
});
export type MarkConversationReadInput = z.infer<typeof markConversationReadSchema>;

// ============================================================================
// Upload média (image) — utilisé par le PostComposer (feed posts)
// ============================================================================
// Le feed posts garde un scope strict images uniquement — le body d'un
// post est riche en formattage, il n'est pas pensé comme un partage de
// fichier. Les fichiers se partagent en DM.
export const POST_MEDIA_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const POST_MEDIA_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export type PostMediaMimeType = (typeof POST_MEDIA_ALLOWED_MIME)[number];

export function isAllowedPostMediaMime(mime: string): mime is PostMediaMimeType {
  return (POST_MEDIA_ALLOWED_MIME as readonly string[]).includes(mime);
}

// ============================================================================
// Upload fichier DM — large, accepte tous les formats classiques
// ============================================================================
// Le composer DM autorise plus de types : PDF, Office, archives, etc.
// La limite est portée à 25 MB pour permettre des PDFs riches. On valide
// le MIME côté server pour bloquer les exécutables.
export const DM_FILE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
export const DM_FILE_ALLOWED_MIME = [
  // Images (cf. POST_MEDIA — duplique pour autonomie)
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // Documents PDF / Office / texte
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/rtf",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  // Média
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;
export type DmFileMimeType = (typeof DM_FILE_ALLOWED_MIME)[number];

export function isAllowedDmFileMime(mime: string): mime is DmFileMimeType {
  return (DM_FILE_ALLOWED_MIME as readonly string[]).includes(mime);
}
