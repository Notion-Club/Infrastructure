"use client";

import { useState } from "react";
import type { Comment } from "../../types/comment.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";

interface CommentListProps {
  comments: Comment[];
  currentUser: User;
  devRole: DevRole;
}

export function CommentList({ comments: initialComments, currentUser, devRole }: CommentListProps) {
  const [comments, setComments] = useState(initialComments);

  function handleNewComment(body: string) {
    const newComment: Comment = {
      id: `new-${Date.now()}`,
      postId: comments[0]?.postId ?? "",
      author: currentUser,
      body,
      reactions: [],
      replies: [],
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [newComment, ...prev]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>
        {comments.length === 0 ? "Sois le premier à commenter" : `${comments.length} commentaire${comments.length !== 1 ? "s" : ""}`}
      </h3>

      {/* Top-level comment composer */}
      <CommentComposer
        currentUser={currentUser}
        devRole={devRole}
        onSubmit={handleNewComment}
      />

      {/* Comments list — each manages its own inline reply */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            devRole={devRole}
            currentUser={currentUser}
          />
        ))}
      </div>
    </div>
  );
}
