"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CommentReply } from "../../types/comment.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { fullDateTime, timeAgo, wasEdited } from "../../utils/date-helpers";
import { renderBodyRich } from "../../utils/render-mentions";
import { buildCommentLink, copyCommunityLink } from "../../utils/copy-link";
import { toggleReactionOptimistic } from "../../utils/reactor";
import { detectVideoEmbed } from "../../utils/video-embed";
import { VideoEmbed } from "../shared/VideoEmbed";
import { useCommentHighlight } from "../../hooks/useCommentHighlight";
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
  postId: string;
  reply: CommentReply;
  devRole: DevRole;
  currentUser: User;
  // Deep-link `?comment=` : id du commentaire/réponse à scroller + surligner.
  highlightId?: string | null;
}

export function CommentReplyItem({ postId, reply, devRole, currentUser, highlightId }: CommentReplyItemProps) {
  const router = useRouter();
  const [replyData, setReplyData] = useState(reply);
  const [reactions, setReactions] = useState(reply.reactions);
  const [editOpen, setEditOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updating, startUpdate] = useTransition();

  const isAuthor = reply.author.id === currentUser.id;
  const isPrivileged = currentUser.role === "admin" || currentUser.role === "mentor";
  const edited = wasEdited(replyData.createdAt, replyData.updatedAt);

  // Deep-link `?comment=` : cette réponse est la cible → scroll + surlignage.
  const { ref: highlightRef, ring } = useCommentHighlight<HTMLDivElement>(highlightId === reply.id);

  // Embed vidéo détecté dans le body de la réponse (allowlist). URL retirée du
  // texte affiché pour ne pas doublonner embed + lien nu.
  const video = detectVideoEmbed(replyData.body);
  const displayBody = video ? replyData.body.replace(video.matchedUrl, "").trim() : replyData.body;

  async function handleReaction(emoji: string) {
    const previous = reactions;
    // Helper partagé : maintient compteur + userReacted + reactors (viewer
    // ajouté/retiré) → mon compte remonte au survol et disparaît au retrait.
    setReactions((prev) => toggleReactionOptimistic(prev, emoji, currentUser));

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
    <div
      ref={highlightRef}
      data-comment-id={reply.id}
      data-fb-label="Réponse à un commentaire · Détail du post"
      style={{
        display: "flex",
        gap: 10,
        paddingLeft: 24,
        borderRadius: 12,
        scrollMarginTop: 120,
        outline: ring ? "2px solid var(--color-brand)" : "2px solid transparent",
        outlineOffset: 4,
        transition: "outline-color var(--nc-duration-slow) var(--nc-ease)",
      }}
    >
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

            {!editOpen && (
              <PostKebabMenu
                onCopyLink={() => copyCommunityLink(buildCommentLink(postId, reply.id))}
                onEdit={isAuthor ? () => setEditOpen(true) : undefined}
                onDelete={isAuthor || isPrivileged ? () => setShowDeleteConfirm(true) : undefined}
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
                displayBody,
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

          {!editOpen && video && <VideoEmbed match={video} label="Vidéo · Réponse" />}

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
