"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Comment } from "../../types/comment.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { fullDateTime, timeAgo, wasEdited } from "../../utils/date-helpers";
import { RichTextRenderer, isRichHtml } from "@/shared/components/editor/RichTextRenderer";
import { renderBodyRich } from "../../utils/render-mentions";
import { UserAvatar } from "../shared/UserAvatar";
import { UserHoverCard } from "../shared/UserHoverCard";
import { ReactionsBar } from "../shared/ReactionsBar";
import { ReactionPicker } from "../shared/ReactionPicker";
import { PostKebabMenu } from "../shared/PostKebabMenu";
import { DeletePostConfirmDialog } from "../shared/DeletePostConfirmDialog";
import { CommentComposer } from "./CommentComposer";
import { CommentReplyItem } from "./CommentReplyItem";
import {
  createCommentReplyAction,
  deleteCommentAction,
  toggleCommentReactionAction,
  updateCommentAction,
} from "../../server/actions";

interface CommentItemProps {
  comment: Comment;
  devRole: DevRole;
  currentUser: User;
  /* onReply removed — reply is handled inline */
}

export function CommentItem({ comment, devRole, currentUser }: CommentItemProps) {
  const router = useRouter();
  const [commentData, setCommentData] = useState(comment);
  const [reactions, setReactions] = useState(comment.reactions);
  const [replyOpen, setReplyOpen] = useState(false);

  // Resync quand le parent re-render avec un comment mis à jour (router.refresh,
  // nouvelle reply persistée côté DB, etc.) — sans ça, `replies` reste figé
  // sur le snapshot initial et les replies fraîchement créées sont invisibles.
  useEffect(() => {
    setCommentData(comment);
    setReactions(comment.reactions);
  }, [comment]);
  const [editOpen, setEditOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [updating, startUpdate] = useTransition();

  const isAuthor = comment.author.id === currentUser.id;
  const isPrivileged = currentUser.role === "admin" || currentUser.role === "mentor";
  const edited = wasEdited(commentData.createdAt, commentData.updatedAt);

  // Un commentaire en cours de persistance porte un id "pending-…" tant que le
  // router.refresh() ne l'a pas remplacé par la vraie ligne DB. Réagir, répondre,
  // éditer ou supprimer dans cette fenêtre échouerait avec "UUID invalide".
  const isPending = comment.id.startsWith("pending-");

  async function handleReaction(emoji: string) {
    if (isPending) {
      toast.info("Attends la fin de la publication du commentaire…");
      return;
    }
    // Optimistic toggle (idem PostCard) — revert on error.
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

    const result = await toggleCommentReactionAction({
      comment_id: comment.id,
      emoji,
    });
    if (!result.ok) {
      setReactions(previous);
      toast.error(result.message);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    const result = await deleteCommentAction(comment.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Commentaire supprimé");
    router.refresh();
  }

  function handleEditSubmit(nextBody: string) {
    const trimmed = nextBody.trim();
    if (!trimmed || trimmed === commentData.body) {
      setEditOpen(false);
      return;
    }
    startUpdate(async () => {
      const result = await updateCommentAction(comment.id, { body: trimmed });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setCommentData((prev) => ({
        ...prev,
        body: trimmed,
        updatedAt: new Date().toISOString(),
      }));
      setEditOpen(false);
      toast.success("Commentaire modifié");
      router.refresh();
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
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <UserHoverCard user={comment.author} devRole={devRole}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", cursor: "pointer" }}>
                  {comment.author.name}
                </span>
              </UserHoverCard>
              <span
                style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                title={`Publié le ${fullDateTime(commentData.createdAt)}${edited ? ` · modifié le ${fullDateTime(commentData.updatedAt)}` : ""}`}
              >
                {timeAgo(commentData.createdAt)}
                {edited && (
                  <>
                    {" · "}
                    <span style={{ fontStyle: "italic" }}>modifié</span>
                  </>
                )}
              </span>
            </div>

            {(isAuthor || isPrivileged) && !editOpen && !isPending && (
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
              placeholder="Modifier votre commentaire…"
              initialValue={commentData.body}
              onCancelReply={() => setEditOpen(false)}
              onSubmit={handleEditSubmit}
              compact
              submitLabel={updating ? "Enregistrement…" : "Enregistrer"}
              disabled={updating}
            />
          ) : (
            <div style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
              {isRichHtml(commentData.body)
                ? <RichTextRenderer html={commentData.body} />
                : renderBodyRich(commentData.body, commentData.mentions)}
            </div>
          )}
        </div>

        {/* Actions */}
        {!editOpen && !isPending && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 4 }}>
            <ReactionsBar reactions={reactions} compact onReact={handleReaction} />
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
        )}

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
              replyingToUser={{ id: comment.author.id, name: comment.author.name }}
              onCancelReply={() => setReplyOpen(false)}
              onSubmit={(body: string, mentions: { id: string; name: string }[]) => {
                const trimmed = body.trim();
                if (!trimmed) return;

                // Optimistic : on injecte la reply dans la liste tout de suite
                // pour qu'elle apparaisse sans attendre router.refresh(). Id
                // "pending-…" évite les actions destructives tant que la vraie
                // ligne n'est pas remontée par la query (cf. useEffect resync).
                const tempId = `pending-${Date.now()}`;
                const optimisticReply = {
                  id: tempId,
                  author: currentUser,
                  body: trimmed,
                  mentions,
                  reactions: [],
                  createdAt: new Date().toISOString(),
                };
                setCommentData((prev) => ({
                  ...prev,
                  replies: [...prev.replies, optimisticReply],
                }));
                setReplyOpen(false);

                startUpdate(async () => {
                  // mention_ids alimente comment_reply_mentions (mig. 022,
                  // N mentions). mentioned_user_id garde la 1re mention
                  // pour rétro-compat du singleton legacy.
                  const result = await createCommentReplyAction({
                    comment_id: commentData.id,
                    body: trimmed,
                    mentioned_user_id: mentions[0]?.id ?? null,
                    mention_ids: mentions.map((m) => m.id),
                  });
                  if (!result.ok) {
                    // Revert optimistic — la reply n'a pas été créée.
                    setCommentData((prev) => ({
                      ...prev,
                      replies: prev.replies.filter((r) => r.id !== tempId),
                    }));
                    toast.error(result.message);
                    return;
                  }
                  toast.success("Réponse envoyée");
                  router.refresh();
                });
              }}
              compact
            />
          </div>
        )}

        {/* Existing replies — pattern LinkedIn :
            - 1 reply  → affichée
            - ≥ 2      → seule la DERNIÈRE (la plus récente) est visible.
                         Bouton "Voir N réponses précédentes" développe tout
                         en ordre chronologique. */}
        {commentData.replies.length > 0 && (() => {
          const total = commentData.replies.length;
          const hiddenCount = total > 1 ? total - 1 : 0;
          const visibleReplies =
            showAllReplies || hiddenCount === 0
              ? commentData.replies
              : commentData.replies.slice(-1);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!showAllReplies && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllReplies(true)}
                  style={{
                    alignSelf: "flex-start",
                    marginLeft: 24,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 0",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    transition: "color 150ms ease",
                  }}
                  className="hover:text-[var(--color-text-primary)]"
                >
                  Voir {hiddenCount} réponse{hiddenCount > 1 ? "s" : ""} précédente{hiddenCount > 1 ? "s" : ""}
                </button>
              )}
              {visibleReplies.map((reply) => (
                <CommentReplyItem
                  key={reply.id}
                  reply={reply}
                  devRole={devRole}
                  currentUser={currentUser}
                />
              ))}
            </div>
          );
        })()}
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
