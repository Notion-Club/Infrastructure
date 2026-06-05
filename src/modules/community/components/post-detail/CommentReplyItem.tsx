"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CommentReply } from "../../types/comment.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { fullDateTime, timeAgo, wasEdited } from "../../utils/date-helpers";
import { renderBodyRich } from "../../utils/render-mentions";
import { UserAvatar } from "../shared/UserAvatar";
import { UserHoverCard } from "../shared/UserHoverCard";
import { ReactionsBar } from "../shared/ReactionsBar";
import { ReactionPicker } from "../shared/ReactionPicker";
import { PostKebabMenu } from "../shared/PostKebabMenu";
import { DeletePostConfirmDialog } from "../shared/DeletePostConfirmDialog";
import { CommentComposer } from "./CommentComposer";
import {
  deleteCommentReplyAction,
  toggleCommentReplyReactionAction,
  updateCommentReplyAction,
} from "../../server/actions";

interface CommentReplyItemProps {
  reply: CommentReply;
  devRole: DevRole;
  currentUser: User;
}

export function CommentReplyItem({ reply, devRole, currentUser }: CommentReplyItemProps) {
  const router = useRouter();
  const [replyData, setReplyData] = useState(reply);
  const [reactions, setReactions] = useState(reply.reactions);
  const [editOpen, setEditOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updating, startUpdate] = useTransition();

  const isAuthor = reply.author.id === currentUser.id;
  const isPrivileged = currentUser.role === "admin" || currentUser.role === "mentor";
  const edited = wasEdited(replyData.createdAt, replyData.updatedAt);

  async function handleReaction(emoji: string) {
    const previous = reactions;
    setReactions((prev) => {
      const exists = prev.find((r) => r.emoji === emoji);
      if (exists) {
        const nextCount = exists.userReacted ? exists.count - 1 : exists.count + 1;
        if (nextCount <= 0 && exists.userReacted) {
          return prev.filter((r) => r.emoji !== emoji);
        }
        return prev.map((r) =>
          r.emoji === emoji
            ? { ...r, count: nextCount, userReacted: !r.userReacted }
            : r,
        );
      }
      return [...prev, { emoji, count: 1, userReacted: true }];
    });

    const result = await toggleCommentReplyReactionAction({
      comment_reply_id: reply.id,
      emoji,
    });
    if (!result.ok) {
      setReactions(previous);
      toast.error(result.message);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    const result = await deleteCommentReplyAction(reply.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Réponse supprimée");
    router.refresh();
  }

  function handleEditSubmit(nextBody: string) {
    const trimmed = nextBody.trim();
    if (!trimmed || trimmed === replyData.body) {
      setEditOpen(false);
      return;
    }
    startUpdate(async () => {
      const result = await updateCommentReplyAction(reply.id, { body: trimmed });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setReplyData((prev) => ({
        ...prev,
        body: trimmed,
        updatedAt: new Date().toISOString(),
      }));
      setEditOpen(false);
      toast.success("Réponse modifiée");
      router.refresh();
    });
  }

  return (
    <div data-fb-label="Réponse à un commentaire · Détail du post" style={{ display: "flex", gap: 10, paddingLeft: 24 }}>
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
        <UserHoverCard user={replyData.author} devRole={devRole}>
          <div style={{ cursor: "pointer" }}>
            <UserAvatar user={replyData.author} size={28} />
          </div>
        </UserHoverCard>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <UserHoverCard user={replyData.author} devRole={devRole}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", cursor: "pointer" }}>
                  {replyData.author.name}
                </span>
              </UserHoverCard>
              <span
                style={{ fontSize: 11, color: "var(--color-text-muted)" }}
                title={`Publié le ${fullDateTime(replyData.createdAt)}${edited ? ` · modifié le ${fullDateTime(replyData.updatedAt)}` : ""}`}
              >
                {timeAgo(replyData.createdAt)}
                {edited && (
                  <>
                    {" · "}
                    <span style={{ fontStyle: "italic" }}>modifié</span>
                  </>
                )}
              </span>
            </div>

            {(isAuthor || isPrivileged) && !editOpen && (
              <PostKebabMenu
                onEdit={isAuthor ? () => setEditOpen(true) : undefined}
                onDelete={() => setShowDeleteConfirm(true)}
              />
            )}
          </div>

          {editOpen ? (
            <CommentComposer
              currentUser={currentUser}
              devRole={devRole}
              placeholder="Modifier votre réponse…"
              initialValue={replyData.body}
              onCancelReply={() => setEditOpen(false)}
              onSubmit={handleEditSubmit}
              compact
              submitLabel={updating ? "Enregistrement…" : "Enregistrer"}
              disabled={updating}
            />
          ) : (
            <div style={{ margin: "4px 0", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {renderBodyRich(
                replyData.body,
                // Source primaire : comment_reply_mentions (mig. 022) qui
                // supporte N mentions. Fallback : le singleton legacy
                // mentionedUser (cas des replies créées avant mig. 022).
                replyData.mentions && replyData.mentions.length > 0
                  ? replyData.mentions
                  : replyData.mentionedUser
                    ? [{ id: replyData.mentionedUser.id, name: replyData.mentionedUser.name }]
                    : [],
              )}
            </div>
          )}

          {!editOpen && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
              <ReactionsBar reactions={reactions} compact onReact={handleReaction} />
              <ReactionPicker onSelect={handleReaction} mode="comment" label="Réagir" />
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <DeletePostConfirmDialog
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
