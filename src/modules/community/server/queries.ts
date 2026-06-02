import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type { Post } from "../types/post.types";
import type { Comment, CommentReply } from "../types/comment.types";
import type { Conversation, Message, MessageType } from "../types/conversation.types";
import type { User, Role, Offer } from "../types/user.types";

// ============================================================================
// Shapes DB (snake_case) — internes au module
// ============================================================================

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  role: string;
  // ISO timestamp d'inscription — alimente User.joinedAt pour joinedAgo().
  created_at: string;
};

type PostRow = {
  id: string;
  author_id: string;
  tag: string;
  audience: string;
  title: string | null;
  body: string;
  image_url: string | null;
  video_url: string | null;
  pinned: boolean;
  pinned_until: string | null;
  // Migration 020 — tier de l'auteur snapshoté (peuplé par trigger DB).
  author_tier: "free" | "paid";
  // Migration 020 — compteurs dénormalisés (maintenus par triggers DB).
  comment_count: number;
  reaction_count: number;
  created_at: string;
  updated_at: string;
  author: ProfileRow | null;
};

type PostReactionRow = {
  post_id: string;
  user_id: string;
  emoji: string;
};

type CommentReactionRow = {
  comment_id: string;
  user_id: string;
  emoji: string;
};

// Migration 020 — réactions sur les replies (table dédiée car comment_reactions
// pointe sur comments uniquement).
type CommentReplyReactionRow = {
  comment_reply_id: string;
  user_id: string;
  emoji: string;
};

// Migration 020 — mentions structurées dans posts et comments. Jointure
// sur profiles pour disposer du name lors du rendu (matching @nom).
type PostMentionRow = {
  post_id: string;
  mentioned_user_id: string;
  mentioned: Pick<ProfileRow, "id" | "first_name" | "last_name" | "display_name" | "username"> | null;
};

type CommentMentionRow = {
  comment_id: string;
  mentioned_user_id: string;
  mentioned: Pick<ProfileRow, "id" | "first_name" | "last_name" | "display_name" | "username"> | null;
};

// Migration 022 — mentions structurées sur les replies.
type CommentReplyMentionRow = {
  comment_reply_id: string;
  mentioned_user_id: string;
  mentioned: Pick<ProfileRow, "id" | "first_name" | "last_name" | "display_name" | "username"> | null;
};

// DM (mig. 014 + 023 + 024) ------------------------------------------------
type ConversationRow = {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  last_message_at: string;
  last_read_a_at: string;
  last_read_b_at: string;
  created_at: string;
  participant_a: ProfileRow | null;
  participant_b: ProfileRow | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  body: string;
  file_url: string | null;
  file_name: string | null;
  deleted: boolean;
  created_at: string;
  edited_at: string | null;
  // Quote-reply (mig. 027) + Forward (mig. 028) — colonnes dénormalisées.
  reply_to_message_id: string | null;
  reply_snippet: string | null;
  reply_author_name: string | null;
  forwarded_from_message_id: string | null;
  forwarded_from_author_name: string | null;
};

type MessageReactionRow = {
  message_id: string;
  user_id: string;
  emoji: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: ProfileRow | null;
};

type CommentReplyRow = {
  id: string;
  comment_id: string;
  author_id: string;
  body: string;
  mentioned_user_id: string | null;
  created_at: string;
  updated_at: string;
  author: ProfileRow | null;
  mentioned: ProfileRow | null;
};

// ============================================================================
// Helpers de mapping DB → UI
// ============================================================================
function computeInitials(p: ProfileRow): string {
  const fn = p.first_name?.trim();
  const ln = p.last_name?.trim();
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (ln) return ln.slice(0, 2).toUpperCase();
  const display = p.display_name?.trim();
  if (display) {
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return p.username?.slice(0, 2).toUpperCase() ?? "?";
}

function computeDisplayName(p: ProfileRow): string {
  const fn = p.first_name?.trim();
  const ln = p.last_name?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  if (fn) return fn;
  if (ln) return ln;
  return p.display_name?.trim() || p.username || "Utilisateur";
}

function mapProfileToUser(p: ProfileRow, offer: Offer = "free"): User {
  return {
    id: p.id,
    name: computeDisplayName(p),
    avatarUrl: p.avatar_url,
    avatarColor: p.avatar_color,
    initials: computeInitials(p),
    role: (p.role === "admin" || p.role === "mentor" ? p.role : "member") as Role,
    offer,
    joinedAt: p.created_at,
  };
}

function deletedUserShape(authorId: string): User {
  return {
    id: authorId,
    name: "Utilisateur supprimé",
    avatarUrl: null,
    avatarColor: null,
    initials: "?",
    role: "member",
    offer: "free",
    joinedAt: "",
    deleted: true,
  };
}

function mapReactions(
  reactions: Array<{ user_id: string; emoji: string }>,
  viewerId: string | null,
): Post["reactions"] {
  const grouped = new Map<string, { count: number; userReacted: boolean }>();
  for (const r of reactions) {
    const current = grouped.get(r.emoji) ?? { count: 0, userReacted: false };
    current.count += 1;
    if (viewerId && r.user_id === viewerId) current.userReacted = true;
    grouped.set(r.emoji, current);
  }
  return Array.from(grouped.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    userReacted: data.userReacted,
  }));
}

function mapPostRow(
  row: PostRow,
  reactions: PostReactionRow[],
  commentCount: number,
  viewerId: string | null,
  mentions: PostMentionRow[] = [],
): Post {
  return {
    id: row.id,
    // Migration 020 — l'offer de l'auteur vient désormais de posts.author_tier,
    // pas d'un défaut 'free'. Le tier est snapshoté au write par trigger DB.
    author: row.author
      ? mapProfileToUser(row.author, row.author_tier)
      : deletedUserShape(row.author_id),
    tag: row.tag as Post["tag"],
    audience: row.audience as Post["audience"],
    title: row.title ?? undefined,
    body: row.body,
    imageUrl: row.image_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    pinned: row.pinned,
    pinnedUntil: row.pinned_until ?? undefined,
    reactions: mapReactions(reactions.filter((r) => r.post_id === row.id), viewerId),
    commentCount,
    mentions: mentions
      .filter((m) => m.post_id === row.id && m.mentioned)
      .map((m) => ({
        id: m.mentioned!.id,
        name: computeDisplayName(m.mentioned as ProfileRow),
      })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// CommunityMember — shape pour le mention picker
// ============================================================================
export type CommunityMember = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  initials: string;
  // Role brut depuis profiles.role — utilisé par NewConversationModal pour
  // afficher "Admin" / "Mentor" sous le nom (sous-titre du picker DM). Tier
  // (free/paid) n'est pas exposé car il dépend d'une dérivation memberships
  // plus coûteuse.
  role: Role;
};

export function mapProfileMember(p: {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role?: string | null;
}): CommunityMember {
  const profileLike: ProfileRow = {
    ...p,
    avatar_color: null,
    role: p.role ?? "member",
    // CommunityMember n'expose pas joinedAt — placeholder pour satisfaire le type.
    created_at: "",
  };
  return {
    id: p.id,
    name: computeDisplayName(profileLike),
    username: p.username,
    avatarUrl: p.avatar_url,
    initials: computeInitials(profileLike),
    role: (p.role === "admin" || p.role === "mentor" ? p.role : "member") as Role,
  };
}

// ============================================================================
// listPosts — feed
// ============================================================================
// RLS posts_select_community + posts_select_paid filtre déjà selon le viewer
// (capability can_view_community + can_view_paid_content). Pas besoin de
// re-filtrer applicativement.
//
// Tri : pinned d'abord, puis created_at desc. Limite 50.
export async function listPosts(): Promise<Post[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      `
        id, author_id, tag, audience, title, body,
        image_url, video_url, pinned, pinned_until,
        author_tier, comment_count, reaction_count,
        created_at, updated_at,
        author:profiles!posts_author_id_fkey (
          id, first_name, last_name, display_name, username,
          avatar_url, avatar_color, role, created_at
        )
      `,
    )
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<PostRow[]>();

  if (error) {
    console.error("[listPosts] failed:", error.message);
    return [];
  }
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  // Réactions + counts comments + mentions en parallèle (1 query chacune).
  // Les mentions joignent profiles pour disposer du name au rendu (matching
  // @nom dans le body).
  const [reactionsRes, commentsForCountRes, mentionsRes] = await Promise.all([
    supabase
      .from("post_reactions")
      .select("post_id, user_id, emoji")
      .in("post_id", postIds)
      .returns<PostReactionRow[]>(),
    supabase.from("comments").select("post_id").in("post_id", postIds),
    supabase
      .from("post_mentions")
      .select(
        `post_id, mentioned_user_id,
         mentioned:profiles!post_mentions_mentioned_user_id_fkey (
           id, first_name, last_name, display_name, username
         )`,
      )
      .in("post_id", postIds)
      .returns<PostMentionRow[]>(),
  ]);

  const commentCountByPost = new Map<string, number>();
  for (const c of commentsForCountRes.data ?? []) {
    commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1);
  }

  return posts.map((row) =>
    mapPostRow(
      row,
      reactionsRes.data ?? [],
      commentCountByPost.get(row.id) ?? 0,
      viewerId,
      mentionsRes.data ?? [],
    ),
  );
}

// ============================================================================
// getPostById — détail d'un post (page /communaute/post/[id])
// ============================================================================
export async function getPostById(id: string): Promise<Post | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const { data: row, error } = await supabase
    .from("posts")
    .select(
      `
        id, author_id, tag, audience, title, body,
        image_url, video_url, pinned, pinned_until,
        author_tier, comment_count, reaction_count,
        created_at, updated_at,
        author:profiles!posts_author_id_fkey (
          id, first_name, last_name, display_name, username,
          avatar_url, avatar_color, role, created_at
        )
      `,
    )
    .eq("id", id)
    .maybeSingle<PostRow>();

  if (error) {
    console.error("[getPostById] failed:", error.message);
    return null;
  }
  if (!row) return null;

  const [reactionsRes, commentsForCountRes, mentionsRes] = await Promise.all([
    supabase
      .from("post_reactions")
      .select("post_id, user_id, emoji")
      .eq("post_id", id)
      .returns<PostReactionRow[]>(),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("post_id", id),
    supabase
      .from("post_mentions")
      .select(
        `post_id, mentioned_user_id,
         mentioned:profiles!post_mentions_mentioned_user_id_fkey (
           id, first_name, last_name, display_name, username
         )`,
      )
      .eq("post_id", id)
      .returns<PostMentionRow[]>(),
  ]);

  return mapPostRow(
    row,
    reactionsRes.data ?? [],
    commentsForCountRes.count ?? 0,
    viewerId,
    mentionsRes.data ?? [],
  );
}

// ============================================================================
// listCommentsForPost — comments + replies + reactions
// ============================================================================
export async function listCommentsForPost(postId: string): Promise<Comment[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const { data: comments, error } = await supabase
    .from("comments")
    .select(
      `
        id, post_id, author_id, body, created_at, updated_at,
        author:profiles!comments_author_id_fkey (
          id, first_name, last_name, display_name, username,
          avatar_url, avatar_color, role, created_at
        )
      `,
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .returns<CommentRow[]>();

  if (error) {
    console.error("[listCommentsForPost] failed:", error.message);
    return [];
  }
  if (!comments || comments.length === 0) return [];

  const commentIds = comments.map((c) => c.id);

  const [repliesRes, reactionsRes, mentionsRes] = await Promise.all([
    supabase
      .from("comment_replies")
      .select(
        `
          id, comment_id, author_id, body, mentioned_user_id, created_at, updated_at,
          author:profiles!comment_replies_author_id_fkey (
            id, first_name, last_name, display_name, username,
            avatar_url, avatar_color, role, created_at
          ),
          mentioned:profiles!comment_replies_mentioned_user_id_fkey (
            id, first_name, last_name, display_name, username,
            avatar_url, avatar_color, role, created_at
          )
        `,
      )
      .in("comment_id", commentIds)
      .order("created_at", { ascending: true })
      .returns<CommentReplyRow[]>(),
    supabase
      .from("comment_reactions")
      .select("comment_id, user_id, emoji")
      .in("comment_id", commentIds)
      .returns<CommentReactionRow[]>(),
    supabase
      .from("comment_mentions")
      .select(
        `comment_id, mentioned_user_id,
         mentioned:profiles!comment_mentions_mentioned_user_id_fkey (
           id, first_name, last_name, display_name, username
         )`,
      )
      .in("comment_id", commentIds)
      .returns<CommentMentionRow[]>(),
  ]);

  const commentMentions = mentionsRes.data ?? [];

  // Migration 020 — comment_reply_reactions : fetch après replies pour
  // disposer des replyIds. RLS SELECT autorise tout viewer qui voit la reply.
  const replies = repliesRes.data ?? [];
  const replyIds = replies.map((r) => r.id);

  // Reactions + mentions des replies en parallèle (les deux dépendent de replyIds).
  const [replyReactionsRes, replyMentionsRes] = replyIds.length
    ? await Promise.all([
        supabase
          .from("comment_reply_reactions")
          .select("comment_reply_id, user_id, emoji")
          .in("comment_reply_id", replyIds)
          .returns<CommentReplyReactionRow[]>(),
        supabase
          .from("comment_reply_mentions")
          .select(
            `comment_reply_id, mentioned_user_id,
             mentioned:profiles!comment_reply_mentions_mentioned_user_id_fkey (
               id, first_name, last_name, display_name, username
             )`,
          )
          .in("comment_reply_id", replyIds)
          .returns<CommentReplyMentionRow[]>(),
      ])
    : [
        { data: [] as CommentReplyReactionRow[] },
        { data: [] as CommentReplyMentionRow[] },
      ];

  const replyReactions = replyReactionsRes.data ?? [];
  const replyMentions = replyMentionsRes.data ?? [];

  const repliesByComment = new Map<string, CommentReply[]>();
  for (const r of replies) {
    const replyUi: CommentReply = {
      id: r.id,
      author: r.author ? mapProfileToUser(r.author) : deletedUserShape(r.author_id),
      body: r.body,
      mentionedUser: r.mentioned ? mapProfileToUser(r.mentioned) : undefined,
      mentions: replyMentions
        .filter((m) => m.comment_reply_id === r.id && m.mentioned)
        .map((m) => ({
          id: m.mentioned!.id,
          name: computeDisplayName(m.mentioned as ProfileRow),
        })),
      reactions: mapReactions(
        replyReactions.filter((rr) => rr.comment_reply_id === r.id),
        viewerId,
      ),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    const list = repliesByComment.get(r.comment_id) ?? [];
    list.push(replyUi);
    repliesByComment.set(r.comment_id, list);
  }

  return comments.map((c) => ({
    id: c.id,
    postId: c.post_id,
    author: c.author ? mapProfileToUser(c.author) : deletedUserShape(c.author_id),
    body: c.body,
    reactions: mapReactions(
      (reactionsRes.data ?? []).filter((r) => r.comment_id === c.id),
      viewerId,
    ),
    replies: repliesByComment.get(c.id) ?? [],
    mentions: commentMentions
      .filter((m) => m.comment_id === c.id && m.mentioned)
      .map((m) => ({
        id: m.mentioned!.id,
        name: computeDisplayName(m.mentioned as ProfileRow),
      })),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

// ============================================================================
// DM — listConversations / getConversation
// ============================================================================
// La RLS conversations_select_participants ne renvoie que les conversations
// où le caller est l'un des deux participants — on n'a donc pas besoin de
// filtrer côté code, juste à résoudre QUI est "l'autre" pour le mapping
// vers Conversation.participant.

function mapMessageRow(row: MessageRow, reactions: MessageReactionRow[]): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    type: row.type as MessageType,
    body: row.body,
    fileUrl: row.file_url ?? undefined,
    fileName: row.file_name ?? undefined,
    reactions: reactions
      .filter((r) => r.message_id === row.id)
      .map((r) => ({ emoji: r.emoji, userId: r.user_id })),
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    deleted: row.deleted,
    replyToMessageId: row.reply_to_message_id,
    replySnippet: row.reply_snippet,
    replyAuthorName: row.reply_author_name,
    forwardedFromMessageId: row.forwarded_from_message_id,
    forwardedFromAuthorName: row.forwarded_from_author_name,
  };
}

// Compteur unread pour le viewer : messages dans cette conv créés après
// son last_read_X_at ET dont il n'est pas l'auteur (ses propres messages
// ne lui notifient rien).
function computeUnreadCount(
  conv: ConversationRow,
  viewerId: string,
  messages: MessageRow[],
): number {
  const isA = conv.participant_a_id === viewerId;
  const cutoff = isA ? conv.last_read_a_at : conv.last_read_b_at;
  return messages.filter(
    (m) =>
      m.conversation_id === conv.id &&
      m.sender_id !== viewerId &&
      m.created_at > cutoff,
  ).length;
}

const CONVERSATIONS_SELECT = `
  id, participant_a_id, participant_b_id, last_message_at,
  last_read_a_at, last_read_b_at, created_at,
  participant_a:profiles!conversations_participant_a_id_fkey (
    id, first_name, last_name, display_name, username,
    avatar_url, avatar_color, role, created_at
  ),
  participant_b:profiles!conversations_participant_b_id_fkey (
    id, first_name, last_name, display_name, username,
    avatar_url, avatar_color, role, created_at
  )
`;

export async function listConversations(): Promise<Conversation[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const viewerId = user.id;

  const { data: rows, error } = await supabase
    .from("conversations")
    .select(CONVERSATIONS_SELECT)
    .order("last_message_at", { ascending: false })
    .limit(100)
    .returns<ConversationRow[]>();

  if (error) {
    console.error("[listConversations] failed:", error.message);
    return [];
  }
  if (!rows || rows.length === 0) return [];

  // Pour calculer unreadCount sans tirer tous les messages, on fetche
  // uniquement ceux postérieurs au plus ancien last_read par viewer.
  // En pratique, la liste-vue n'affiche que le count : on garde une query
  // light qui ne ramène que conversation_id + sender_id + created_at.
  const convIds = rows.map((r) => r.id);
  const { data: lightMessages } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, type, body, file_url, file_name, deleted, created_at, edited_at, reply_to_message_id, reply_snippet, reply_author_name, forwarded_from_message_id, forwarded_from_author_name")
    .in("conversation_id", convIds)
    .returns<MessageRow[]>();

  const messages = lightMessages ?? [];

  return rows.map((row) => {
    const isA = row.participant_a_id === viewerId;
    const other = isA ? row.participant_b : row.participant_a;
    const otherId = isA ? row.participant_b_id : row.participant_a_id;
    return {
      id: row.id,
      participant: other ? mapProfileToUser(other) : deletedUserShape(otherId),
      messages: [],
      unreadCount: computeUnreadCount(row, viewerId, messages),
      lastMessageAt: row.last_message_at,
    };
  });
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const viewerId = user.id;

  const { data: row, error } = await supabase
    .from("conversations")
    .select(CONVERSATIONS_SELECT)
    .eq("id", id)
    .maybeSingle<ConversationRow>();

  if (error) {
    console.error("[getConversation] failed:", error.message);
    return null;
  }
  if (!row) return null;

  const [messagesRes, reactionsRes] = await Promise.all([
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, type, body, file_url, file_name, deleted, created_at, edited_at, reply_to_message_id, reply_snippet, reply_author_name, forwarded_from_message_id, forwarded_from_author_name")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .returns<MessageRow[]>(),
    // message_reactions joint via les message_ids — on fetch en parallèle
    // pour limiter la latence ; on filtre par conversation_id côté DB via
    // une sous-requête INNER JOIN implicite que PostgREST ne supporte pas
    // sur des chemins indirects. À défaut on fetche par message_id.
    Promise.resolve({ data: [] as MessageReactionRow[] }),
  ]);

  const messages = messagesRes.data ?? [];
  let reactions: MessageReactionRow[] = [];
  if (messages.length > 0) {
    const ids = messages.map((m) => m.id);
    const { data: rxs } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", ids)
      .returns<MessageReactionRow[]>();
    reactions = rxs ?? [];
  }

  const isA = row.participant_a_id === viewerId;
  const other = isA ? row.participant_b : row.participant_a;
  const otherId = isA ? row.participant_b_id : row.participant_a_id;

  return {
    id: row.id,
    participant: other ? mapProfileToUser(other) : deletedUserShape(otherId),
    messages: messages.map((m) => mapMessageRow(m, reactions)),
    unreadCount: computeUnreadCount(row, viewerId, messages),
    lastMessageAt: row.last_message_at,
  };
}
