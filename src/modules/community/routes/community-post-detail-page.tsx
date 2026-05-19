"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Post } from "../types/post.types";
import type { DevRole } from "../hooks/useDevRoleToggle";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getCommentsByPostId } from "../mocks/comments.mock";
import { timeAgo } from "../utils/date-helpers";
import { UserAvatar } from "../components/shared/UserAvatar";
import { UserHoverCard } from "../components/shared/UserHoverCard";
import { TagPill } from "../components/shared/TagPill";
import { ReactionsBar } from "../components/shared/ReactionsBar";
import { ReactionPicker } from "../components/shared/ReactionPicker";
import { PostKebabMenu } from "../components/shared/PostKebabMenu";
import { CommentList } from "../components/post-detail/CommentList";

interface CommunityPostDetailPageProps {
  post: Post;
  devRole: DevRole;
}

export function CommunityPostDetailPage({ post, devRole }: CommunityPostDetailPageProps) {
  const router = useRouter();
  const currentUser = useCurrentUser(devRole);
  const [reactions, setReactions] = useState(post.reactions);
  const comments = getCommentsByPostId(post.id);
  const isAuthor = post.author.id === currentUser.id;

  function handleReaction(emoji: string) {
    setReactions((prev) => {
      const exists = prev.find((r) => r.emoji === emoji);
      if (exists) {
        return prev.map((r) =>
          r.emoji === emoji ? { ...r, count: r.userReacted ? r.count - 1 : r.count + 1, userReacted: !r.userReacted } : r
        );
      }
      return [...prev, { emoji, count: 1, userReacted: true }];
    });
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 14,
          color: "var(--color-text-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontWeight: 500,
          padding: 0,
          transition: "color 150ms ease",
        }}
        className="hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft size={16} />
        Retour à la communauté
      </button>

      {/* Post complet */}
      <article
        style={{
          background: "white",
          border: "1px solid var(--color-border-default)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "var(--nc-shadow-3)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {post.pinned && (
          <div>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 700, color: "var(--color-brand)",
              background: "rgba(224,98,90,0.08)", padding: "3px 8px",
              borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              📌 Épinglé
            </span>
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <UserHoverCard user={post.author} devRole={devRole}>
              <div style={{ cursor: "pointer" }}>
                <UserAvatar user={post.author} size={44} />
              </div>
            </UserHoverCard>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <UserHoverCard user={post.author} devRole={devRole}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", cursor: "pointer" }}>
                    {post.author.name}
                  </span>
                </UserHoverCard>
                <TagPill tag={post.tag} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
                {timeAgo(post.createdAt)}
              </p>
            </div>
          </div>
          {isAuthor && (
            <PostKebabMenu
              onEdit={() => alert("Modifier (mock)")}
              onDelete={() => router.back()}
            />
          )}
        </div>

        {/* Content */}
        {post.title && (
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
            {post.title}
          </h1>
        )}

        <div style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
          {post.body}
        </div>

        {post.imageUrl && (
          <div style={{ borderRadius: 12, overflow: "hidden" }}>
            <img src={post.imageUrl} alt="" style={{ width: "100%", maxHeight: 400, objectFit: "cover", display: "block" }} />
          </div>
        )}

        {post.videoUrl && (
          <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "16/9" }}>
            <iframe
              src={`https://www.youtube.com/embed/${post.videoUrl.split("v=")[1]?.split("&")[0] ?? ""}`}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Reactions */}
        <div style={{ paddingTop: 4, borderTop: "1px solid var(--color-border-default)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <ReactionsBar reactions={reactions} commentCount={comments.length} />
          <ReactionPicker onSelect={handleReaction} mode="post" selectedEmojis={reactions.filter((r) => r.userReacted).map((r) => r.emoji)} />
        </div>
      </article>

      {/* Comments */}
      <div
        style={{
          background: "white",
          border: "1px solid var(--color-border-default)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "var(--nc-shadow-3)",
        }}
      >
        <CommentList
          comments={comments}
          currentUser={currentUser}
          devRole={devRole}
        />
      </div>
    </div>
  );
}
