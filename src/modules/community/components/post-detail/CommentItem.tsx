"use client";

import { useState } from "react";
import type { Comment } from "../../types/comment.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { timeAgo } from "../../utils/date-helpers";
import { UserAvatar } from "../shared/UserAvatar";
import { UserHoverCard } from "../shared/UserHoverCard";
import { ReactionsBar } from "../shared/ReactionsBar";
import { ReactionPicker } from "../shared/ReactionPicker";
import { CommentComposer } from "./CommentComposer";
import { CommentReplyItem } from "./CommentReplyItem";

interface CommentItemProps {
  comment: Comment;
  devRole: DevRole;
  currentUser: User;
  /* onReply removed — reply is handled inline */
}

export function CommentItem({ comment, devRole, currentUser }: CommentItemProps) {
  const viewer = useCurrentUser(devRole);
  const [reactions, setReactions] = useState(comment.reactions);
  const [replyOpen, setReplyOpen] = useState(false);

  function handleReaction(emoji: string) {
    setReactions((prev) => {
      const userHas = prev.find((r) => r.userReacted);
      if (userHas?.emoji === emoji) {
        return prev.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, userReacted: false } : r);
      }
      const cleared = prev.map((r) => r.userReacted ? { ...r, count: r.count - 1, userReacted: false } : r);
      const target = cleared.find((r) => r.emoji === emoji);
      if (target) return cleared.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r);
      return [...cleared, { emoji, count: 1, userReacted: true }];
    });
  }

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <UserHoverCard user={comment.author} devRole={devRole}>
        <div style={{ cursor: "pointer", flexShrink: 0 }}>
          <UserAvatar user={comment.author} size={36} />
        </div>
      </UserHoverCard>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Comment bubble */}
        <div
          style={{
            background: "var(--color-surface-raised)",
            borderRadius: 12,
            padding: "10px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <UserHoverCard user={comment.author} devRole={devRole}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", cursor: "pointer" }}>
                {comment.author.name}
              </span>
            </UserHoverCard>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{timeAgo(comment.createdAt)}</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {comment.body}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 4 }}>
          <ReactionsBar reactions={reactions} compact />
          <ReactionPicker onSelect={handleReaction} mode="comment" label="Réagir" />
          <button
            type="button"
            onClick={() => setReplyOpen((o) => !o)}
            style={{
              fontSize: 12,
              color: replyOpen ? "var(--color-brand)" : "var(--color-text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              padding: "2px 0",
              transition: "color 150ms ease",
            }}
          >
            {replyOpen ? "Annuler" : "Répondre"}
          </button>
        </div>

        {/* Inline reply composer — opens directly below this comment */}
        {replyOpen && (
          <div
            style={{
              animation: "nc-mode-in 180ms var(--nc-ease) both",
              paddingLeft: 4,
            }}
          >
            <CommentComposer
              currentUser={currentUser}
              devRole={devRole}
              placeholder={`Répondre à ${comment.author.name}…`}
              replyingTo={comment.author.name}
              onCancelReply={() => setReplyOpen(false)}
              onSubmit={(body) => {
                // In a real app: POST reply. Here we just close.
                setReplyOpen(false);
              }}
              compact
            />
          </div>
        )}

        {/* Existing replies */}
        {comment.replies.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {comment.replies.map((reply) => (
              <CommentReplyItem key={reply.id} reply={reply} devRole={devRole} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
