import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type { Post, PostTag, PostCursor, PostsPage } from "../types/post.types";
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
    username: p.username,
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
    username: null,
    avatarUrl: null,
    avatarColor: null,
    initials: "?",
    role: "member",
    offer: "free",
    joinedAt: "",
    deleted: true,
  };
}

// Convertit un profil DB en shape Reactor pour l'affichage du hover popover.
// Le nom + initiales + avatar suivent les helpers déjà utilisés pour User
// (computeDisplayName / computeInitials).
function mapProfileToReactor(p: ProfileRow): {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  avatarColor: string | null;
} {
  return {
    id: p.id,
    name: computeDisplayName(p),
    initials: computeInitials(p),
    avatarUrl: p.avatar_url,
    avatarColor: p.avatar_color,
  };
}

function mapReactions(
  reactions: Array<{ user_id: string; emoji: string }>,
  viewerId: string | null,
  profilesById?: Map<string, ProfileRow>,
): Post["reactions"] {
  const grouped = new Map<
    string,
    {
      count: number;
      userReacted: boolean;
      reactors: ReturnType<typeof mapProfileToReactor>[];
    }
  >();
  for (const r of reactions) {
    const current =
      grouped.get(r.emoji) ?? { count: 0, userReacted: false, reactors: [] };
    current.count += 1;
    if (viewerId && r.user_id === viewerId) current.userReacted = true;
    const profile = profilesById?.get(r.user_id);
    if (profile) current.reactors.push(mapProfileToReactor(profile));
    grouped.set(r.emoji, current);
  }
  return Array.from(grouped.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    userReacted: data.userReacted,
    reactors: data.reactors,
  }));
}

function mapPostRow(
  row: PostRow,
  reactions: PostReactionRow[],
  commentCount: number,
  viewerId: string | null,
  mentions: PostMentionRow[] = [],
  reactorProfilesById: Map<string, ProfileRow> = new Map(),
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
    reactions: mapReactions(
      reactions.filter((r) => r.post_id === row.id),
      viewerId,
      reactorProfilesById,
    ),
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
// listPostsPage — feed paginé (keyset)
// ============================================================================
// RLS posts_select_community + posts_select_paid filtre déjà selon le viewer
// (capability can_view_community + can_view_paid_content). Pas de re-filtrage
// applicatif.
//
// Colonnes du feed — partagées entre listPostsPage et getPostById.
const POST_SELECT = `
  id, author_id, tag, audience, title, body,
  image_url, video_url, pinned, pinned_until,
  author_tier, comment_count, reaction_count,
  created_at, updated_at,
  author:profiles!posts_author_id_fkey (
    id, first_name, last_name, display_name, username,
    avatar_url, avatar_color, role, created_at
  )
`;

// Helper partagé (listPostsPage) : hydrate des lignes `posts` en Post[] complets
// — réactions + mentions + profils des reactors, en batch (1 query par table).
// Le nombre de commentaires vient de posts.comment_count (dénormalisé, maintenu
// par triggers mig. 020). Factorisé pour éviter tout copier-coller du mapping.
async function hydratePosts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  rows: PostRow[],
  viewerId: string | null,
): Promise<Post[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map((p) => p.id);

  // Réactions + mentions en parallèle. Les mentions joignent profiles pour
  // disposer du name au rendu (matching @nom dans le body).
  const [reactionsRes, mentionsRes] = await Promise.all([
    supabase
      .from("post_reactions")
      .select("post_id, user_id, emoji")
      .in("post_id", postIds)
      .returns<PostReactionRow[]>(),
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

  // Profils de tous les users qui ont réagi — alimente Reaction.reactors pour
  // le hover popover (cf. ReactionsBar).
  const reactorIds = Array.from(
    new Set((reactionsRes.data ?? []).map((r) => r.user_id)),
  );
  const reactorProfilesById = await fetchReactorProfiles(supabase, reactorIds);

  return rows.map((row) =>
    mapPostRow(
      row,
      reactionsRes.data ?? [],
      row.comment_count ?? 0,
      viewerId,
      mentionsRes.data ?? [],
      reactorProfilesById,
    ),
  );
}

// Pagination keyset par (created_at, id) décroissant.
//
// ⚠️ Tie-break `id` OBLIGATOIRE : beaucoup de posts importés partagent la même
// created_at (dates Slack au jour/heure près). Trier uniquement sur created_at
// sauterait ou dupliquerait des posts entre pages.
//
// Pinned : les posts épinglés ACTIFS (pinned=true, pinned_until nul ou futur)
// sont chargés une seule fois, en tête, sur la 1re page (cursor null), et
// EXCLUS du flux keyset (`.eq("pinned", false)`) pour ne jamais être dupliqués.
export async function listPostsPage(
  params: {
    cursor?: PostCursor | null;
    tag?: PostTag | "all";
    limit?: number;
  } = {},
): Promise<PostsPage> {
  const { cursor = null, tag = "all", limit = 50 } = params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  // 1re page uniquement : les pinned actifs, en tête. Absents des pages
  // suivantes (cursor non nul) pour ne pas les répéter.
  let pinnedPosts: Post[] = [];
  if (!cursor) {
    const nowIso = new Date().toISOString();
    let pinnedQuery = supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("pinned", true)
      .or(`pinned_until.is.null,pinned_until.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (tag !== "all") pinnedQuery = pinnedQuery.eq("tag", tag);
    const { data: pinnedRows, error: pinnedError } =
      await pinnedQuery.returns<PostRow[]>();
    if (pinnedError) {
      console.error("[listPostsPage] pinned failed:", pinnedError.message);
    } else {
      pinnedPosts = await hydratePosts(supabase, pinnedRows ?? [], viewerId);
    }
  }

  // Flux keyset : posts NON épinglés, (created_at, id) desc.
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("pinned", false)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // +1 = sonde `hasMore` (on ne renvoie que `limit`).

  if (tag !== "all") query = query.eq("tag", tag);

  if (cursor) {
    // Keyset : (created_at, id) < (cursor.createdAt, cursor.id). On repasse la
    // valeur created_at EXACTE de la page précédente (pas de reformat, sinon
    // l'égalité timestamptz casse).
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data: fluxRows, error } = await query.returns<PostRow[]>();
  if (error) {
    console.error("[listPostsPage] flux failed:", error.message);
    return { posts: pinnedPosts, nextCursor: null, hasMore: false };
  }

  const rows = fluxRows ?? [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const fluxPosts = await hydratePosts(supabase, pageRows, viewerId);

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last ? { createdAt: last.created_at, id: last.id } : null;

  return {
    posts: [...pinnedPosts, ...fluxPosts],
    nextCursor,
    hasMore,
  };
}

// ============================================================================
// listPosts — wrapper compat (1re page, limite 50). Conservé pour les appelants
// qui n'ont pas besoin du curseur (ex. hors feed) ; le feed utilise directement
// listPostsPage pour disposer de nextCursor/hasMore.
// ============================================================================
export async function listPosts(): Promise<Post[]> {
  const { posts } = await listPostsPage({ limit: 50 });
  return posts;
}

// Helper partagé : récupère les profils des reactors par id. RLS
// profiles_select_same_org (mig. 025) garantit que le caller voit les
// profils des membres de sa propre org. Si une réaction pointe sur un
// profil hors-org (cas marginal cross-org plus tard), elle apparaîtra
// sans reactor associé — l'UI doit le tolérer.
async function fetchReactorProfiles(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userIds: string[],
): Promise<Map<string, ProfileRow>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, display_name, username, avatar_url, avatar_color, role, created_at",
    )
    .in("id", userIds)
    .returns<ProfileRow[]>();
  const map = new Map<string, ProfileRow>();
  for (const p of data ?? []) map.set(p.id, p);
  return map;
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

  // Réactions + mentions en parallèle. Le nombre de commentaires vient de
  // posts.comment_count (dénormalisé, trigger-maintenu) — plus de count SQL.
  const [reactionsRes, mentionsRes] = await Promise.all([
    supabase
      .from("post_reactions")
      .select("post_id, user_id, emoji")
      .eq("post_id", id)
      .returns<PostReactionRow[]>(),
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

  const reactorIds = Array.from(
    new Set((reactionsRes.data ?? []).map((r) => r.user_id)),
  );
  const reactorProfilesById = await fetchReactorProfiles(supabase, reactorIds);

  return mapPostRow(
    row,
    reactionsRes.data ?? [],
    row.comment_count ?? 0,
    viewerId,
    mentionsRes.data ?? [],
    reactorProfilesById,
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

  // Charge en une seule requête les profils des reactors (comments + replies)
  // pour alimenter Reaction.reactors lors du hover popover.
  const reactorIds = Array.from(
    new Set([
      ...(reactionsRes.data ?? []).map((r) => r.user_id),
      ...replyReactions.map((r) => r.user_id),
    ]),
  );
  const reactorProfilesById = await fetchReactorProfiles(supabase, reactorIds);

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
        reactorProfilesById,
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
      reactorProfilesById,
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

// Forme de retour du RPC community_conversation_summaries (mig. 045).
type ConversationSummaryRow = {
  conversation_id: string;
  last_message_sender_id: string | null;
  last_message_type: string | null;
  last_message_body: string | null;
  last_message_file_name: string | null;
  last_message_created_at: string | null;
  unread: number;
};

// Colonnes d'un message chargées pour le rendu d'une bulle. Source unique
// (getConversation / loadOlderMessages / getMessagesSince / hydratation eager
// s'y réfèrent) pour ne pas dériver si le schéma évolue.
const MESSAGE_SELECT_COLUMNS =
  "id, conversation_id, sender_id, type, body, file_url, file_name, deleted, created_at, edited_at, reply_to_message_id, reply_snippet, reply_author_name, forwarded_from_message_id, forwarded_from_author_name";

// Nombre de conversations (les plus récentes) dont on pré-charge la dernière
// page de messages DÈS le listing, côté serveur.
//
// Pourquoi : listConversations renvoyait messages:[] pour TOUTES les convs →
// ouvrir une conversation coûtait un aller-retour client (getConversationAction :
// re-validation Auth + messages + réactions) AVANT d'afficher la moindre bulle.
// C'est la lenteur ressentie « au premier chargement ». Comme on ouvre presque
// toujours une conversation récente, pré-charger la dernière page des N convs de
// tête rend l'ouverture instantanée (0 aller-retour ; le client seed son cache
// loadedConvIds depuis ces messages). Borné à N × MESSAGES_PAGE_SIZE, servi par
// l'index messages_conversation_idx (conversation_id, created_at desc, mig. 014).
const HYDRATE_TOP_CONVERSATIONS = 5;

// Pré-charge la dernière page de messages (+ réactions) des conversations
// passées, en parallèle (une query/conv — PostgREST ne sait pas faire un
// « N dernières lignes PAR groupe » sans window function/RPC), puis une SEULE
// query réactions batchée sur tous les ids. Renvoie une Map convId → page.
async function hydrateRecentMessages(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationIds: string[],
): Promise<Map<string, { messages: Message[]; hasMore: boolean }>> {
  const out = new Map<string, { messages: Message[]; hasMore: boolean }>();
  if (conversationIds.length === 0) return out;

  const perConv = await Promise.all(
    conversationIds.map(async (cid) => {
      const { data } = await supabase
        .from("messages")
        .select(MESSAGE_SELECT_COLUMNS)
        .eq("conversation_id", cid)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PAGE_SIZE + 1)
        .returns<MessageRow[]>();
      const rows = data ?? [];
      const hasMore = rows.length > MESSAGES_PAGE_SIZE;
      const messages = (hasMore ? rows.slice(0, MESSAGES_PAGE_SIZE) : rows).reverse();
      return { cid, messages, hasMore };
    }),
  );

  const allIds = perConv.flatMap((p) => p.messages.map((m) => m.id));
  let reactions: MessageReactionRow[] = [];
  if (allIds.length > 0) {
    const { data: rxs } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", allIds)
      .returns<MessageReactionRow[]>();
    reactions = rxs ?? [];
  }

  for (const { cid, messages, hasMore } of perConv) {
    out.set(cid, { messages: messages.map((m) => mapMessageRow(m, reactions)), hasMore });
  }
  return out;
}

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

  // Résumé par conversation (dernier message non supprimé + unreadCount) en UNE
  // requête bornée via le RPC community_conversation_summaries (mig. 045).
  // AVANT : on chargeait TOUS les messages des 100 convs (O(total messages)) pour
  // dériver ces deux infos en JS. Désormais le calcul est fait en base, indexé,
  // borné aux convs de la page → la sidebar ne dépend plus du volume d'historique.
  const convIds = rows.map((r) => r.id);
  const { data: summaries, error: sumError } = await supabase.rpc(
    "community_conversation_summaries",
    { p_conversation_ids: convIds },
  );
  if (sumError) {
    console.error("[listConversations] summaries failed:", sumError.message);
  }
  const summaryRows = (summaries ?? []) as ConversationSummaryRow[];
  const summaryById = new Map<string, ConversationSummaryRow>();
  for (const s of summaryRows) summaryById.set(s.conversation_id, s);

  // Hydratation eager de la dernière page des N conversations les plus récentes
  // (rows est déjà trié last_message_at desc). Le client marque ces convs comme
  // « déjà chargées » → ouverture instantanée sans aller-retour (cf.
  // HYDRATE_TOP_CONVERSATIONS et MessagesLayout.loadedConvIds).
  const hydrated = await hydrateRecentMessages(
    supabase,
    rows.slice(0, HYDRATE_TOP_CONVERSATIONS).map((r) => r.id),
  );

  return rows.map((row) => {
    const isA = row.participant_a_id === viewerId;
    const other = isA ? row.participant_b : row.participant_a;
    const otherId = isA ? row.participant_b_id : row.participant_a_id;
    const summary = summaryById.get(row.id);

    // Preview tronquée côté serveur à 140 chars (l'UI affiche ~50 via CSS).
    // Libellé symbolique pour les attachments (📷 Image / 📎 Fichier).
    let preview: string | undefined;
    const t = summary?.last_message_type;
    if (t === "text") {
      preview = (summary?.last_message_body ?? "").slice(0, 140);
    } else if (t === "image") {
      preview = "📷 Image";
    } else if (t) {
      preview = `📎 ${summary?.last_message_file_name ?? "Fichier"}`;
    }

    const page = hydrated.get(row.id);

    return {
      id: row.id,
      participant: other ? mapProfileToUser(other) : deletedUserShape(otherId),
      // Top-N convs : messages pré-chargés (ouverture instantanée). Autres :
      // [] → chargées à la demande via getConversationAction (inchangé).
      messages: page?.messages ?? [],
      hasMore: page?.hasMore,
      unreadCount: summary?.unread ?? 0,
      lastMessageAt: row.last_message_at,
      lastMessagePreview: preview,
      lastMessageFromMe: summary?.last_message_sender_id
        ? summary.last_message_sender_id === viewerId
        : undefined,
      lastMessageType: t ? (t as MessageType) : undefined,
    };
  });
}

// Pagination cursor-based. On charge par défaut les MESSAGES_PAGE_SIZE
// messages les plus récents (tri DESC en DB pour limiter, puis on inverse
// côté serveur pour rendre dans l'ordre chronologique au client).
// hasMore = true s'il existe des messages plus anciens — on le détecte en
// demandant size+1 puis en vérifiant si la query a renvoyé size+1 lignes.
export const MESSAGES_PAGE_SIZE = 50;

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

  // Charge les N derniers + 1 (sentinel pour détecter hasMore). Tri DESC
  // côté DB → on inverse en local pour ordre chronologique ascendant.
  const { data: rawMessages } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT_COLUMNS)
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PAGE_SIZE + 1)
    .returns<MessageRow[]>();

  const rows = rawMessages ?? [];
  const hasMore = rows.length > MESSAGES_PAGE_SIZE;
  const messages = (hasMore ? rows.slice(0, MESSAGES_PAGE_SIZE) : rows).reverse();

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
    hasMore,
  };
}

// Charge le batch de messages PRÉCÉDENT le cursor (le 1er message visible
// côté client). Renvoie messages en ordre chronologique ascendant + hasMore.
// RLS messages_select_participant (mig. 014) couvre l'autorisation.
export async function loadOlderMessages(
  conversationId: string,
  cursorMessageId: string,
): Promise<{ messages: Message[]; hasMore: boolean } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Récupère le created_at du cursor — la RLS coupe si non-participant.
  const { data: cursorRow } = await supabase
    .from("messages")
    .select("id, created_at, conversation_id")
    .eq("id", cursorMessageId)
    .eq("conversation_id", conversationId)
    .maybeSingle<{ id: string; created_at: string; conversation_id: string }>();
  if (!cursorRow) return null;

  const { data: rawMessages } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT_COLUMNS)
    .eq("conversation_id", conversationId)
    .lt("created_at", cursorRow.created_at)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PAGE_SIZE + 1)
    .returns<MessageRow[]>();

  const rows = rawMessages ?? [];
  const hasMore = rows.length > MESSAGES_PAGE_SIZE;
  const messages = (hasMore ? rows.slice(0, MESSAGES_PAGE_SIZE) : rows).reverse();

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

  return {
    messages: messages.map((m) => mapMessageRow(m, reactions)),
    hasMore,
  };
}

// ============================================================================
// getMessagesSince — delta des messages plus récents qu'un timestamp
// ============================================================================
// Utilisé par la réception Realtime (handleIncomingMessage) pour n'ajouter QUE
// les nouveaux messages au lieu de re-fetcher toute la conversation. Borné à
// MESSAGES_PAGE_SIZE (au-delà, le client retombera sur un open/full-load). RLS
// messages_select_participants couvre l'autorisation. Ordre chronologique ASC.
export async function getMessagesSince(
  conversationId: string,
  afterIso: string,
): Promise<Message[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rawMessages } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT_COLUMNS)
    .eq("conversation_id", conversationId)
    .gt("created_at", afterIso)
    .order("created_at", { ascending: true })
    .limit(MESSAGES_PAGE_SIZE)
    .returns<MessageRow[]>();

  const rows = rawMessages ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((m) => m.id);
  const { data: rxs } = await supabase
    .from("message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", ids)
    .returns<MessageReactionRow[]>();
  const reactions = rxs ?? [];

  return rows.map((m) => mapMessageRow(m, reactions));
}

// ============================================================================
// Recherche full-text dans une conversation unique
// ============================================================================
// Implémentation simple via ilike (case-insensitive). On évite l'injection
// de wildcards LIKE en escapant `%` et `_`. Tri ASC pour faciliter le scroll
// vers le résultat dans le thread. Limite à 50 résultats — au-delà l'UX
// devient peu lisible.
export const SEARCH_MAX_RESULTS = 50;
export const SEARCH_QUERY_MIN = 2;

export interface SearchMessageHit {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  type: MessageType;
}

function escapeLikeWildcards(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function searchMessagesInConversation(
  conversationId: string,
  query: string,
): Promise<SearchMessageHit[]> {
  const supabase = await createSupabaseServerClient();
  const trimmed = query.trim();
  if (trimmed.length < SEARCH_QUERY_MIN) return [];

  const pattern = `%${escapeLikeWildcards(trimmed)}%`;
  const { data, error } = await supabase
    .from("messages")
    .select("id, body, sender_id, created_at, type")
    .eq("conversation_id", conversationId)
    .eq("deleted", false)
    .ilike("body", pattern)
    .order("created_at", { ascending: true })
    .limit(SEARCH_MAX_RESULTS)
    .returns<Array<{ id: string; body: string; sender_id: string; created_at: string; type: string }>>();

  if (error) {
    console.error("[searchMessagesInConversation] failed:", error.message);
    return [];
  }
  return (data ?? []).map((m) => ({
    id: m.id,
    body: m.body,
    senderId: m.sender_id,
    createdAt: m.created_at,
    type: m.type as MessageType,
  }));
}
