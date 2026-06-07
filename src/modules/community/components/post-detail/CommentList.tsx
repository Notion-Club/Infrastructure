"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Comment } from "../../types/comment.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";
import { createCommentAction } from "../../server/actions";

interface CommentListProps {
  postId: string;
  comments: Comment[];
  currentUser: User;
  devRole: DevRole;
}

export function CommentList({ postId, comments: initialComments, currentUser, devRole }: CommentListProps) {
  const [comments, setComments] = useState(initialComments);
  const [, startSubmit] = useTransition();
  const router = useRouter();

  // Resync l'état local quand router.refresh() ramène de nouveaux comments
  // (les optimistic "pending-…" sont remplacés par les vraies lignes DB).
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  function handleNewComment(body: string, mentions: { id: string; name: string }[]) {
    const trimmed = body.trim();
    if (!trimmed) return;

    // Optimistic insert avec un id temporaire — sera remplacé par la vraie
    // ligne au prochain router.refresh().
    const tempId = `pending-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      postId,
      author: currentUser,
      body: trimmed,
      reactions: [],
      replies: [],
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);

    startSubmit(async () => {
      const result = await createCommentAction({
        post_id: postId,
        body: trimmed,
        mention_ids: mentions.map((m) => m.id),
      });
      if (!result.ok) {
        // Revert optimistic on error
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
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
      <div data-fb-label="Liste des commentaires · Détail du post" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
