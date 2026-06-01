"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import {
  createCommentReplySchema,
  createCommentSchema,
  createConversationSchema,
  createPostSchema,
  isAllowedPostMediaMime,
  markConversationReadSchema,
  POST_MEDIA_ALLOWED_MIME,
  POST_MEDIA_MAX_BYTES,
  sendMessageSchema,
  toggleCommentReactionSchema,
  toggleCommentReplyReactionSchema,
  togglePostReactionSchema,
  updateCommentReplySchema,
  updateCommentSchema,
  updatePostSchema,
  type CreateCommentInput,
  type CreateCommentReplyInput,
  type CreateConversationInput,
  type CreatePostInput,
  type MarkConversationReadInput,
  type SendMessageInput,
  type ToggleCommentReactionInput,
  type ToggleCommentReplyReactionInput,
  type TogglePostReactionInput,
  type UpdateCommentInput,
  type UpdateCommentReplyInput,
  type UpdatePostInput,
} from "../lib/validation";
import { getConversation, mapProfileMember, type CommunityMember } from "./queries";
import type { Conversation } from "../types/conversation.types";

const COMMUNITY_BUCKET = "community";

// ============================================================================
// Types de retour communs
// ============================================================================

export type CreatePostResult =
  | { ok: true; postId: string }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "forbidden" | "unknown";
      message: string;
    };

export type UpdatePostResult =
  | { ok: true }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "forbidden" | "unknown";
      message: string;
    };

export type DeletePostResult =
  | { ok: true }
  | {
      ok: false;
      code: "not_authenticated" | "forbidden" | "unknown";
      message: string;
    };

export type UploadPostMediaResult =
  | { ok: true; publicUrl: string }
  | {
      ok: false;
      code:
        | "no_file"
        | "invalid_mime"
        | "file_too_large"
        | "not_authenticated"
        | "upload_failed"
        | "unknown";
      message: string;
    };

export type CreateCommentResult =
  | { ok: true; commentId: string }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "unknown";
      message: string;
    };

export type UpdateCommentResult =
  | { ok: true }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "forbidden" | "unknown";
      message: string;
    };

export type DeleteCommentResult =
  | { ok: true }
  | {
      ok: false;
      code: "not_authenticated" | "forbidden" | "unknown";
      message: string;
    };

export type ToggleReactionResult =
  | { ok: true; isAdded: boolean }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "unknown";
      message: string;
    };

// Replies (migration 014 + 020) ---------------------------------------------
export type CreateCommentReplyResult =
  | { ok: true; replyId: string }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "unknown";
      message: string;
    };

export type UpdateCommentReplyResult =
  | { ok: true }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "forbidden" | "unknown";
      message: string;
    };

export type DeleteCommentReplyResult =
  | { ok: true }
  | {
      ok: false;
      code: "not_authenticated" | "forbidden" | "unknown";
      message: string;
    };

// DM (migration 014 + 023 + 024) -------------------------------------------
export type CreateConversationResult =
  | { ok: true; conversationId: string; alreadyExists: boolean }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "forbidden" | "self" | "unknown";
      message: string;
    };

export type SendMessageResult =
  | { ok: true; messageId: string }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "forbidden" | "unknown";
      message: string;
    };

export type MarkConversationReadResult =
  | { ok: true }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "forbidden" | "unknown";
      message: string;
    };

// ============================================================================
// Helpers
// ============================================================================
async function getCallerRole(): Promise<{
  userId: string;
  role: "member" | "mentor" | "admin";
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();
  if (!profile) return null;

  const role =
    profile.role === "admin" || profile.role === "mentor" ? profile.role : "member";
  return { userId: user.id, role };
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/jpeg":
    default:
      return "jpg";
  }
}

// ============================================================================
// createPostAction — publication
// ============================================================================
// Sécurité :
//   - user_id récupéré via session (jamais d'input client)
//   - Validation zod (titre min 3 chars, body min 1 char, audience + tag enum)
//   - pinned forcé à false si caller pas admin/mentor (defense-in-depth, la
//     RLS empêcherait quand même un member d'épingler un post d'admin)
export async function createPostAction(
  input: CreatePostInput,
): Promise<CreatePostResult> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour publier.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const isPrivileged = caller.role === "admin" || caller.role === "mentor";

  const payload = {
    author_id: caller.userId,
    title: parsed.data.title,
    body: parsed.data.body,
    tag: parsed.data.tag,
    audience: parsed.data.audience,
    pinned: isPrivileged ? parsed.data.pinned : false,
    pinned_until: isPrivileged ? parsed.data.pinned_until ?? null : null,
    image_url: parsed.data.image_url ?? null,
    video_url: parsed.data.video_url ?? null,
  };

  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("[createPost] failed:", error?.message);
    return {
      ok: false,
      code: "unknown",
      message: error?.message ?? "Impossible de publier le post.",
    };
  }

  // Persistance des @mentions dans la table post_mentions (migration 020).
  // Best-effort : un échec n'invalide pas le post déjà publié. RLS
  // post_mentions_insert_author limite aux mentions du post qu'on vient
  // d'insérer (author_id = auth.uid()).
  const mentionIds = parsed.data.mention_ids ?? [];
  if (mentionIds.length > 0) {
    const { error: mentionsError } = await supabase
      .from("post_mentions")
      .insert(
        mentionIds.map((uid) => ({
          post_id: data.id,
          mentioned_user_id: uid,
        })),
      );
    if (mentionsError) {
      console.error("[createPost] mentions insert failed:", mentionsError.message);
    }
  }

  revalidatePath("/communaute");
  return { ok: true, postId: data.id };
}

// ============================================================================
// updatePostAction — édition
// ============================================================================
export async function updatePostAction(
  postId: string,
  input: UpdatePostInput,
): Promise<UpdatePostResult> {
  const parsed = updatePostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour modifier ce post.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const isPrivileged = caller.role === "admin" || caller.role === "mentor";

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.body !== undefined) patch.body = parsed.data.body;
  if (parsed.data.tag !== undefined) patch.tag = parsed.data.tag;
  if (parsed.data.audience !== undefined) patch.audience = parsed.data.audience;
  if (parsed.data.image_url !== undefined) patch.image_url = parsed.data.image_url;
  if (parsed.data.video_url !== undefined) patch.video_url = parsed.data.video_url;
  if (isPrivileged) {
    if (parsed.data.pinned !== undefined) patch.pinned = parsed.data.pinned;
    if (parsed.data.pinned_until !== undefined)
      patch.pinned_until = parsed.data.pinned_until;
  }

  const { error } = await supabase.from("posts").update(patch).eq("id", postId);
  if (error) {
    console.error("[updatePost] failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }

  revalidatePath("/communaute");
  revalidatePath(`/communaute/post/${postId}`);
  return { ok: true };
}

// ============================================================================
// deletePostAction
// ============================================================================
// RLS posts_delete_author_or_admin restreint au author ou admin/mentor.
// ON DELETE CASCADE propre déjà les comments, replies, reactions liés.
export async function deletePostAction(
  postId: string,
): Promise<DeletePostResult> {
  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour supprimer ce post.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) {
    console.error("[deletePost] failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }

  revalidatePath("/communaute");
  return { ok: true };
}

// ============================================================================
// uploadPostMediaAction — image vers bucket community/uploads/<user_id>/
// ============================================================================
export async function uploadPostMediaAction(
  formData: FormData,
): Promise<UploadPostMediaResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, code: "no_file", message: "Aucun fichier reçu." };
  }

  if (!isAllowedPostMediaMime(file.type)) {
    return {
      ok: false,
      code: "invalid_mime",
      message: `Format non supporté. Utilise ${POST_MEDIA_ALLOWED_MIME.join(", ")}.`,
    };
  }

  if (file.size > POST_MEDIA_MAX_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: `Le fichier dépasse ${Math.round(POST_MEDIA_MAX_BYTES / 1024 / 1024)} MB.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour uploader une image.",
    };
  }

  const ext = extensionForMime(file.type);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `uploads/${user.id}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(COMMUNITY_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) {
    console.error("[uploadPostMedia] storage upload failed:", uploadError.message);
    return {
      ok: false,
      code: "upload_failed",
      message: "Impossible d'envoyer l'image. Réessaie.",
    };
  }

  const { data: urlData } = supabase.storage
    .from(COMMUNITY_BUCKET)
    .getPublicUrl(path);

  return { ok: true, publicUrl: urlData.publicUrl };
}

// ============================================================================
// listMembersAction — autocomplete mentions @ depuis le composer
// ============================================================================
// Sert d'API côté client (le composer est un composant client donc ne peut
// pas appeler queries.ts qui utilise createSupabaseServerClient sans
// "use server").
export async function listMembersAction(): Promise<CommunityMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, display_name, username, avatar_url, role")
    .order("username", { ascending: true, nullsFirst: false })
    .limit(50)
    .returns<
      Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
        role: string | null;
      }>
    >();

  if (error) {
    console.error("[listMembersAction] failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapProfileMember);
}

// ============================================================================
// createCommentAction
// ============================================================================
export async function createCommentAction(
  input: CreateCommentInput,
): Promise<CreateCommentResult> {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour commenter.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: parsed.data.post_id,
      author_id: caller.userId,
      body: parsed.data.body,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("[createComment] failed:", error?.message);
    return {
      ok: false,
      code: "unknown",
      message: error?.message ?? "Impossible d'envoyer le commentaire.",
    };
  }

  // Persistance des @mentions dans la table comment_mentions (migration 020).
  // Best-effort : un échec ici n'invalide pas le commentaire déjà publié, on
  // log et on continue. RLS comment_mentions_insert_author garantit que seul
  // l'auteur peut insérer, ce qui est forcément le cas ici.
  const mentionIds = parsed.data.mention_ids ?? [];
  if (mentionIds.length > 0) {
    const { error: mentionsError } = await supabase
      .from("comment_mentions")
      .insert(
        mentionIds.map((uid) => ({
          comment_id: data.id,
          mentioned_user_id: uid,
        })),
      );
    if (mentionsError) {
      console.error("[createComment] mentions insert failed:", mentionsError.message);
    }
  }

  revalidatePath(`/communaute/post/${parsed.data.post_id}`);
  revalidatePath("/communaute");
  return { ok: true, commentId: data.id };
}

// ============================================================================
// updateCommentAction — édition du body d'un commentaire
// ============================================================================
// La RLS comments_update_author_or_admin (migration 014) gère l'autorisation.
// Le trigger comments_set_updated_at bump updated_at automatiquement — l'UI
// peut donc afficher un marqueur "modifié" en comparant created_at vs updated_at.
export async function updateCommentAction(
  commentId: string,
  input: UpdateCommentInput,
): Promise<UpdateCommentResult> {
  const parsed = updateCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour modifier ce commentaire.",
    };
  }

  const supabase = await createSupabaseServerClient();
  // On a besoin du post_id pour revalidatePath ; on le fetch avant update.
  const { data: existing } = await supabase
    .from("comments")
    .select("post_id")
    .eq("id", commentId)
    .maybeSingle<{ post_id: string }>();

  const { error } = await supabase
    .from("comments")
    .update({ body: parsed.data.body })
    .eq("id", commentId);
  if (error) {
    console.error("[updateComment] failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }

  if (existing?.post_id) {
    revalidatePath(`/communaute/post/${existing.post_id}`);
  }
  revalidatePath("/communaute");
  return { ok: true };
}

// ============================================================================
// deleteCommentAction
// ============================================================================
// RLS comments_delete_author_or_admin restreint au author ou admin/mentor.
// ON DELETE CASCADE propre déjà les replies et reactions liés.
export async function deleteCommentAction(
  commentId: string,
): Promise<DeleteCommentResult> {
  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour supprimer ce commentaire.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("comments")
    .select("post_id")
    .eq("id", commentId)
    .maybeSingle<{ post_id: string }>();

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);
  if (error) {
    console.error("[deleteComment] failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }

  if (existing?.post_id) {
    revalidatePath(`/communaute/post/${existing.post_id}`);
  }
  revalidatePath("/communaute");
  return { ok: true };
}

// ============================================================================
// createCommentReplyAction — réponse imbriquée à un commentaire
// ============================================================================
// RLS comment_replies_insert_self (migration 014) impose author_id = auth.uid()
// et l'existence du comment parent. mentioned_user_id est optionnel (ON DELETE
// SET NULL côté FK).
export async function createCommentReplyAction(
  input: CreateCommentReplyInput,
): Promise<CreateCommentReplyResult> {
  const parsed = createCommentReplySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour répondre.",
    };
  }

  const supabase = await createSupabaseServerClient();

  // On résout le post_id du comment parent pour revalidatePath ciblé.
  const { data: parentComment } = await supabase
    .from("comments")
    .select("post_id")
    .eq("id", parsed.data.comment_id)
    .maybeSingle<{ post_id: string }>();

  const { data, error } = await supabase
    .from("comment_replies")
    .insert({
      comment_id: parsed.data.comment_id,
      author_id: caller.userId,
      body: parsed.data.body,
      mentioned_user_id: parsed.data.mentioned_user_id ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("[createCommentReply] failed:", error?.message);
    return {
      ok: false,
      code: "unknown",
      message: error?.message ?? "Impossible d'envoyer la réponse.",
    };
  }

  // Persistance des @mentions dans la table comment_reply_mentions (mig. 022).
  // Best-effort : un échec n'invalide pas la reply déjà publiée. RLS
  // comment_reply_mentions_insert_author garantit que seul l'auteur peut
  // insérer (forcément le cas ici).
  const mentionIds = parsed.data.mention_ids ?? [];
  if (mentionIds.length > 0) {
    const { error: mentionsError } = await supabase
      .from("comment_reply_mentions")
      .insert(
        mentionIds.map((uid) => ({
          comment_reply_id: data.id,
          mentioned_user_id: uid,
        })),
      );
    if (mentionsError) {
      console.error("[createCommentReply] mentions insert failed:", mentionsError.message);
    }
  }

  revalidatePath("/communaute");
  if (parentComment?.post_id) {
    revalidatePath(`/communaute/post/${parentComment.post_id}`);
  }
  return { ok: true, replyId: data.id };
}

// ============================================================================
// updateCommentReplyAction — édition du body d'une réponse
// ============================================================================
// RLS comment_replies_update_author_or_admin (migration 014) gère l'autorisation
// (auteur ou admin/mentor). Trigger comment_replies_set_updated_at bump le
// updated_at automatiquement.
export async function updateCommentReplyAction(
  replyId: string,
  input: UpdateCommentReplyInput,
): Promise<UpdateCommentReplyResult> {
  const parsed = updateCommentReplySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour modifier cette réponse.",
    };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch post_id via la jointure comments pour revalidatePath ciblé.
  const { data: existing } = await supabase
    .from("comment_replies")
    .select("comment_id, comments(post_id)")
    .eq("id", replyId)
    .maybeSingle<{ comment_id: string; comments: { post_id: string } | null }>();

  const { error } = await supabase
    .from("comment_replies")
    .update({ body: parsed.data.body })
    .eq("id", replyId);
  if (error) {
    console.error("[updateCommentReply] failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }

  revalidatePath("/communaute");
  if (existing?.comments?.post_id) {
    revalidatePath(`/communaute/post/${existing.comments.post_id}`);
  }
  return { ok: true };
}

// ============================================================================
// deleteCommentReplyAction
// ============================================================================
// RLS comment_replies_delete_author_or_admin restreint au author ou admin/mentor.
// ON DELETE CASCADE côté FK propre déjà les comment_reply_reactions.
export async function deleteCommentReplyAction(
  replyId: string,
): Promise<DeleteCommentReplyResult> {
  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour supprimer cette réponse.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("comment_replies")
    .select("comment_id, comments(post_id)")
    .eq("id", replyId)
    .maybeSingle<{ comment_id: string; comments: { post_id: string } | null }>();

  const { error } = await supabase
    .from("comment_replies")
    .delete()
    .eq("id", replyId);
  if (error) {
    console.error("[deleteCommentReply] failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }

  revalidatePath("/communaute");
  if (existing?.comments?.post_id) {
    revalidatePath(`/communaute/post/${existing.comments.post_id}`);
  }
  return { ok: true };
}

// ============================================================================
// togglePostReactionAction
// ============================================================================
// Si la ligne (post, user, emoji) existe → DELETE, sinon INSERT. La PK
// composite côté DB garantit l'unicité.
export async function togglePostReactionAction(
  input: TogglePostReactionInput,
): Promise<ToggleReactionResult> {
  const parsed = togglePostReactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Connecte-toi pour réagir.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { post_id, emoji } = parsed.data;

  // Lookup existante
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", post_id)
    .eq("user_id", caller.userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("post_reactions")
      .delete()
      .eq("post_id", post_id)
      .eq("user_id", caller.userId)
      .eq("emoji", emoji);
    if (error) {
      return { ok: false, code: "unknown", message: error.message };
    }
    revalidatePath("/communaute");
    revalidatePath(`/communaute/post/${post_id}`);
    return { ok: true, isAdded: false };
  }

  const { error } = await supabase.from("post_reactions").insert({
    post_id,
    user_id: caller.userId,
    emoji,
  });
  if (error) {
    return { ok: false, code: "unknown", message: error.message };
  }
  revalidatePath("/communaute");
  revalidatePath(`/communaute/post/${post_id}`);
  return { ok: true, isAdded: true };
}

// ============================================================================
// toggleCommentReactionAction
// ============================================================================
export async function toggleCommentReactionAction(
  input: ToggleCommentReactionInput,
): Promise<ToggleReactionResult> {
  const parsed = toggleCommentReactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Connecte-toi pour réagir.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { comment_id, emoji } = parsed.data;

  const { data: existing } = await supabase
    .from("comment_reactions")
    .select("comment_id")
    .eq("comment_id", comment_id)
    .eq("user_id", caller.userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("comment_reactions")
      .delete()
      .eq("comment_id", comment_id)
      .eq("user_id", caller.userId)
      .eq("emoji", emoji);
    if (error) return { ok: false, code: "unknown", message: error.message };
    revalidatePath("/communaute");
    return { ok: true, isAdded: false };
  }

  const { error } = await supabase.from("comment_reactions").insert({
    comment_id,
    user_id: caller.userId,
    emoji,
  });
  if (error) return { ok: false, code: "unknown", message: error.message };
  revalidatePath("/communaute");
  return { ok: true, isAdded: true };
}

// ============================================================================
// toggleCommentReplyReactionAction (migration 020 — comment_reply_reactions)
// ============================================================================
// Symétrique de toggleCommentReactionAction, sur la table dédiée aux replies.
// Permet aux membres de réagir aux réponses imbriquées d'un commentaire.
export async function toggleCommentReplyReactionAction(
  input: ToggleCommentReplyReactionInput,
): Promise<ToggleReactionResult> {
  const parsed = toggleCommentReplyReactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Connecte-toi pour réagir.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { comment_reply_id, emoji } = parsed.data;

  const { data: existing } = await supabase
    .from("comment_reply_reactions")
    .select("comment_reply_id")
    .eq("comment_reply_id", comment_reply_id)
    .eq("user_id", caller.userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("comment_reply_reactions")
      .delete()
      .eq("comment_reply_id", comment_reply_id)
      .eq("user_id", caller.userId)
      .eq("emoji", emoji);
    if (error) return { ok: false, code: "unknown", message: error.message };
    revalidatePath("/communaute");
    return { ok: true, isAdded: false };
  }

  const { error } = await supabase.from("comment_reply_reactions").insert({
    comment_reply_id,
    user_id: caller.userId,
    emoji,
  });
  if (error) return { ok: false, code: "unknown", message: error.message };
  revalidatePath("/communaute");
  return { ok: true, isAdded: true };
}

// ============================================================================
// createConversationAction — créer ou réutiliser la conv 1-1 avec un user
// ============================================================================
// La table conversations impose participant_a_id < participant_b_id (CHECK)
// et UNIQUE(participant_a_id, participant_b_id). On canonise donc la paire
// avant l'INSERT, et on regarde d'abord si la conv existe déjà — sinon
// l'UNIQUE constraint nous renvoie une erreur qu'on aurait à parser.
// La RLS conversations_insert_with_two_silo (mig. 024) bloque les paires
// inter-tier (sauf admin/mentor). On laisse Postgres trancher : si la RLS
// refuse, on remonte "forbidden" plutôt que de dupliquer la règle ici.
export async function createConversationAction(
  input: CreateConversationInput,
): Promise<CreateConversationResult> {
  const parsed = createConversationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Connecte-toi pour démarrer une conversation.",
    };
  }

  if (parsed.data.target_user_id === caller.userId) {
    return {
      ok: false,
      code: "self",
      message: "Tu ne peux pas démarrer une conversation avec toi-même.",
    };
  }

  // Canonisation : participant_a < participant_b (CHECK côté DB).
  const a = caller.userId < parsed.data.target_user_id
    ? caller.userId
    : parsed.data.target_user_id;
  const b = caller.userId < parsed.data.target_user_id
    ? parsed.data.target_user_id
    : caller.userId;

  const supabase = await createSupabaseServerClient();

  // Lookup avant INSERT pour distinguer "déjà existante" de "interdite".
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("participant_a_id", a)
    .eq("participant_b_id", b)
    .maybeSingle<{ id: string }>();

  if (existing) {
    return { ok: true, conversationId: existing.id, alreadyExists: true };
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({ participant_a_id: a, participant_b_id: b })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("[createConversation] failed:", error?.message);
    // Si la RLS two-silo a refusé, le message Postgres est cryptique.
    // On retombe sur "forbidden" pour clarifier côté UI.
    const msg = error?.message ?? "Impossible de créer la conversation.";
    const isRlsBlock = /row-level security|new row violates/i.test(msg);
    return {
      ok: false,
      code: isRlsBlock ? "forbidden" : "unknown",
      message: isRlsBlock
        ? "Cette personne n'accepte pas les messages d'utilisateurs de ton tier."
        : msg,
    };
  }

  revalidatePath("/communaute");
  return { ok: true, conversationId: data.id, alreadyExists: false };
}

// ============================================================================
// sendMessageAction — INSERT un message + bump conversations.last_message_at
// ============================================================================
// La RLS messages_insert_self (mig. 014) garantit que sender = caller. Le
// bump de last_message_at est nécessaire pour le tri DESC côté listConversations.
// Trigger DB de bump non utilisé pour rester explicite et éviter un trigger
// SECURITY DEFINER de plus.
export async function sendMessageAction(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Connecte-toi pour envoyer un message.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversation_id,
      sender_id: caller.userId,
      type: parsed.data.type,
      body: parsed.data.body,
      file_url: parsed.data.file_url ?? null,
      file_name: parsed.data.file_name ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("[sendMessage] failed:", error?.message);
    return {
      ok: false,
      code: "unknown",
      message: error?.message ?? "Impossible d'envoyer le message.",
    };
  }

  // Bump last_message_at — RLS conversations_update_participants gère l'auth.
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", parsed.data.conversation_id);

  revalidatePath("/communaute");
  return { ok: true, messageId: data.id };
}

// ============================================================================
// markConversationReadAction — bump le last_read_X_at du caller
// ============================================================================
// On résout quel participant le caller incarne (a ou b) puis on UPDATE la
// colonne correspondante. La RLS conversations_update_participants laisse
// passer si caller est l'un des deux participants.
export async function markConversationReadAction(
  input: MarkConversationReadInput,
): Promise<MarkConversationReadResult> {
  const parsed = markConversationReadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const caller = await getCallerRole();
  if (!caller) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Connecte-toi pour marquer comme lu.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("participant_a_id, participant_b_id")
    .eq("id", parsed.data.conversation_id)
    .maybeSingle<{ participant_a_id: string; participant_b_id: string }>();

  if (!conv) {
    return {
      ok: false,
      code: "forbidden",
      message: "Conversation introuvable.",
    };
  }

  const isA = conv.participant_a_id === caller.userId;
  const isB = conv.participant_b_id === caller.userId;
  if (!isA && !isB) {
    return {
      ok: false,
      code: "forbidden",
      message: "Tu ne participes pas à cette conversation.",
    };
  }

  const now = new Date().toISOString();
  const payload = isA ? { last_read_a_at: now } : { last_read_b_at: now };

  const { error } = await supabase
    .from("conversations")
    .update(payload)
    .eq("id", parsed.data.conversation_id);

  if (error) {
    console.error("[markConversationRead] failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }

  revalidatePath("/communaute");
  return { ok: true };
}

// ============================================================================
// getConversationAction — wrapper Server Action de getConversation()
// ============================================================================
// La query getConversation() est server-side. Pour qu'un composant client
// puisse re-fetch les messages d'une conv au moment où l'utilisateur la
// sélectionne (sans router.refresh() complet), on l'expose comme action.
// La RLS gère l'autorisation : null retourné si caller non participant.
export async function getConversationAction(
  conversationId: string,
): Promise<Conversation | null> {
  return getConversation(conversationId);
}
