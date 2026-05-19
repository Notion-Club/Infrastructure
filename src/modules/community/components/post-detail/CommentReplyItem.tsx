"use client";

import { useState } from "react";
import type { CommentReply } from "../../types/comment.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { timeAgo } from "../../utils/date-helpers";
import { UserAvatar } from "../shared/UserAvatar";
import { UserHoverCard } from "../shared/UserHoverCard";
import { ReactionsBar } from "../shared/ReactionsBar";
import { ReactionPicker } from "../shared/ReactionPicker";

interface CommentReplyItemProps {
  reply: CommentReply;
  devRole: DevRole;
}

export function CommentReplyItem({ reply, devRole }: CommentReplyItemProps) {
  const viewer = useCurrentUser(devRole);
  const [reactions, setReactions] = useState(reply.reactions);
  const isAuthor = reply.author.id === viewer.id;

  function handleReaction(emoji: string) {
    setReactions((prev) => {
      const userHas = prev.find((r) => r.userReacted);
      if (userHas?.emoji === emoji) {
        return prev.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, userReacted: false } : r);
      }
      return prev
        .map((r) => r.userReacted ? { ...r, count: r.count - 1, userReacted: false } : r)
        .map((r) => r.emoji === emoji
          ? { ...r, count: r.count + 1, userReacted: true }
          : r
        ).concat(
          prev.find((r) => r.emoji === emoji) ? [] : [{ emoji, count: 1, userReacted: true }]
        );
    });
  }

  return (
    <div style={{ display: "flex", gap: 10, paddingLeft: 24 }}>
      <div
        style={{
          width: 1.5,
          background: "var(--color-border-default)",
          borderRadius: 9999,
          flexShrink: 0,
          minHeight: 20,
          marginTop: 4,
        }}
      />
      <div style={{ flex: 1, display: "flex", gap: 10 }}>
        <UserHoverCard user={reply.author} devRole={devRole}>
          <div style={{ cursor: "pointer" }}>
            <UserAvatar user={reply.author} size={28} />
          </div>
        </UserHoverCard>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <UserHoverCard user={reply.author} devRole={devRole}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", cursor: "pointer" }}>
                {reply.author.name}
              </span>
            </UserHoverCard>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{timeAgo(reply.createdAt)}</span>
          </div>
          <p style={{ margin: "4px 0", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {reply.mentionedUser && (
              <span style={{ color: "var(--color-brand)", fontWeight: 500 }}>@{reply.mentionedUser.name}{" "}</span>
            )}
            {reply.mentionedUser
              ? reply.body.replace(`@${reply.mentionedUser.name}`, "").trim()
              : reply.body}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <ReactionsBar reactions={reactions} compact />
            <ReactionPicker onSelect={handleReaction} mode="comment" label="Réagir" />
          </div>
        </div>
      </div>
    </div>
  );
}
