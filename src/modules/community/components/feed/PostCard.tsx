"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Post } from "../../types/post.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { timeAgo } from "../../utils/date-helpers";
import { linkify } from "../../utils/linkify";
import { UserAvatar } from "../shared/UserAvatar";
import { UserHoverCard } from "../shared/UserHoverCard";
import { TagPill } from "../shared/TagPill";
import { ReactionsBar } from "../shared/ReactionsBar";
import { PostKebabMenu } from "../shared/PostKebabMenu";
import { PostComposerModal } from "../post-composer/PostComposerModal";

interface PostCardProps {
  post: Post;
  currentUser: User;
  devRole: DevRole;
  pinned?: boolean;
}

function isYouTube(url: string) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function getYouTubeId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return match ? match[1] : null;
}

export function PostCard({ post, currentUser, devRole, pinned = false }: PostCardProps) {
  const router = useRouter();
  const [reactions, setReactions] = useState(post.reactions);
  const [postData, setPostData] = useState(post);
  const [showEditComposer, setShowEditComposer] = useState(false);
  const isAuthor = post.author.id === currentUser.id;

  function handleCardClick() {
    try { sessionStorage.setItem("communaute:scrollY", String(window.scrollY)); } catch {}
    router.push(`/communaute/post/${post.id}`);
  }

  function handleReaction(emoji: string) {
    setReactions((prev) => {
      const exists = prev.find((r) => r.emoji === emoji);
      if (exists) {
        return prev.map((r) =>
          r.emoji === emoji
            ? { ...r, count: r.userReacted ? r.count - 1 : r.count + 1, userReacted: !r.userReacted }
            : r
        );
      }
      return [...prev, { emoji, count: 1, userReacted: true }];
    });
  }

  return (
    <>
    <article
      onClick={handleCardClick}
      style={{
        background: "var(--color-surface-card)",
        border: pinned ? "1.5px solid var(--color-brand)" : "1px solid var(--color-border-default)",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: "pointer",
        transition: "box-shadow 200ms var(--nc-ease), transform 200ms var(--nc-ease)",
        boxShadow: "var(--nc-shadow-3)",
      }}
      className="hover:shadow-[rgba(0,0,0,0.10)_0px_8px_32px_0px,rgba(0,0,0,0.04)_0px_1px_3px_0px]"
    >
      {/* Pinned badge */}
      {pinned && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-brand)",
              background: "rgba(224,98,90,0.08)",
              padding: "3px 8px",
              borderRadius: 9999,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            📌 Épinglé
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <UserHoverCard user={post.author} devRole={devRole}>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              <UserAvatar user={post.author} size={40} />
            </button>
          </UserHoverCard>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <UserHoverCard user={post.author} devRole={devRole}>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {post.author.name}
                </button>
              </UserHoverCard>
              <TagPill tag={post.tag} size="sm" />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
              {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>

        {isAuthor && (
          <div onClick={(e) => e.stopPropagation()}>
            <PostKebabMenu
              onEdit={() => setShowEditComposer(true)}
              onDelete={() => alert("Supprimer (mock)")}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {postData.title && (
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              lineHeight: 1.3,
            }}
          >
            {postData.title}
          </h2>
        )}
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-text-secondary)",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
          }}
        >
          {linkify(postData.body)}
        </p>

        {postData.imageUrl && (
          <div style={{ borderRadius: 12, overflow: "hidden", marginTop: 4 }}>
            <img
              src={postData.imageUrl}
              alt=""
              style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {postData.videoUrl && isYouTube(postData.videoUrl) && (
          <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "16/9", marginTop: 4 }}>
            <iframe
              src={`https://www.youtube.com/embed/${getYouTubeId(postData.videoUrl)}`}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div onClick={(e) => e.stopPropagation()}>
        <ReactionsBar
          reactions={reactions}
          commentCount={postData.commentCount}
          compact
          onReact={handleReaction}
          onCommentClick={() => router.push(`/communaute/post/${post.id}#comments`)}
        />
      </div>
    </article>

    {showEditComposer && (
      <PostComposerModal
        currentUser={currentUser}
        initialPost={postData}
        onClose={() => setShowEditComposer(false)}
        onPublish={(updated) => {
          setPostData((prev) => ({ ...prev, ...updated }));
          setShowEditComposer(false);
        }}
      />
    )}
    </>
  );
}
