"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowReturn } from "@/shared/components/icons";
import { toast } from "sonner";
import type { Post } from "../types/post.types";
import type { Comment } from "../types/comment.types";
import type { DevRole } from "../hooks/useDevRoleToggle";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { fullDateTime, timeAgo, wasEdited } from "../utils/date-helpers";
import { renderBodyRich } from "../utils/render-mentions";
import { UserAvatar } from "../components/shared/UserAvatar";
import { UserHoverCard } from "../components/shared/UserHoverCard";
import { TagPill } from "../components/shared/TagPill";
import { ReactionsBar } from "../components/shared/ReactionsBar";
import { ReactionPicker } from "../components/shared/ReactionPicker";
import { PostKebabMenu } from "../components/shared/PostKebabMenu";
import { PostComposerModal } from "../components/post-composer/PostComposerModal";
import { CommentList } from "../components/post-detail/CommentList";
import { DeletePostConfirmDialog } from "../components/shared/DeletePostConfirmDialog";
import { ImageLightbox } from "../components/shared/ImageLightbox";
import { ImageLightboxRoot } from "../components/shared/ImageLightboxRoot";
import {
  deletePostAction,
  togglePostReactionAction,
  updatePostAction,
} from "../server/actions";

interface CommunityPostDetailPageProps {
  post: Post;
  initialComments: Comment[];
  devRole: DevRole;
}

export function CommunityPostDetailPage({
  post,
  initialComments,
  devRole,
}: CommunityPostDetailPageProps) {
  const router = useRouter();
  const currentUser = useCurrentUser(devRole);
  const [postData, setPostData] = useState(post);
  const [reactions, setReactions] = useState(post.reactions);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditComposer, setShowEditComposer] = useState(false);
  const [imageLightbox, setImageLightbox] = useState(false);
  const [editing, startEdit] = useTransition();
  const comments = initialComments;
  const isAuthor = post.author.id === currentUser.id;
  const isPrivileged = currentUser.role === "admin" || currentUser.role === "mentor";
  const edited = wasEdited(postData.createdAt, postData.updatedAt);

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

    const result = await togglePostReactionAction({
      post_id: post.id,
      emoji,
    });
    if (!result.ok) {
      setReactions(previous);
      toast.error(result.message);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    const result = await deletePostAction(post.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Post supprimé");
    router.push("/communaute");
    router.refresh();
  }

  // Admin/mentor uniquement — la RLS 021 bloque tout membre standard. Pattern
  // optimistic + revert identique à PostCard.
  async function handleTogglePin() {
    const nextPinned = !postData.pinned;
    setPostData((prev) => ({ ...prev, pinned: nextPinned }));
    const result = await updatePostAction(post.id, { pinned: nextPinned });
    if (!result.ok) {
      setPostData((prev) => ({ ...prev, pinned: !nextPinned }));
      toast.error(result.message);
      return;
    }
    toast.success(nextPinned ? "Post épinglé" : "Post désépinglé");
    router.refresh();
  }

  return (
    <>
    <ImageLightboxRoot />
    {showDeleteConfirm && (
      <DeletePostConfirmDialog
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    )}
    <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        data-fb-label="Bouton Retour · Détail du post"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px 6px 10px",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          width: "fit-content",
          transition: "all 150ms ease",
        }}
        className="hover:bg-[#eaeaea] hover:text-[var(--color-text-primary)] dark:hover:bg-[rgba(255,255,255,0.10)]"
      >
        <ArrowReturn size={14} />
        Retour à la communauté
      </button>

      {/* Post complet */}
      <article
        data-fb-label="Carte post · Détail du post"
        style={{
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "var(--nc-shadow-3)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          viewTransitionName: `post-card-${post.id}`,
        }}
      >
        {postData.pinned && (
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
              <div data-fb-label="Avatar auteur · Détail du post" style={{ cursor: "pointer" }}>
                <UserAvatar user={post.author} size={44} />
              </div>
            </UserHoverCard>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <UserHoverCard user={post.author} devRole={devRole}>
                  <span data-fb-label="Lien auteur · Détail du post" style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", cursor: "pointer" }}>
                    {post.author.name}
                  </span>
                </UserHoverCard>
                <TagPill tag={postData.tag} />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <span>{timeAgo(postData.createdAt)}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>{fullDateTime(postData.createdAt)}</span>
                {edited && (
                  <>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span
                      style={{ fontStyle: "italic" }}
                      title={`Modifié le ${fullDateTime(postData.updatedAt)}`}
                    >
                      modifié
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          {(isAuthor || isPrivileged) && (
            <PostKebabMenu
              onEdit={isAuthor ? () => setShowEditComposer(true) : undefined}
              onDelete={() => setShowDeleteConfirm(true)}
              onTogglePin={isPrivileged ? handleTogglePin : undefined}
              pinned={postData.pinned}
            />
          )}
        </div>

        {/* Content */}
        {postData.title && (
          <h1 data-fb-label="Titre du post · Détail du post" style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
            {postData.title}
          </h1>
        )}

        <div style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
          {renderBodyRich(postData.body, postData.mentions)}
        </div>

        {postData.imageUrl && (
          /* Slack-like : preview modérée, click ouvre lightbox plein écran. */
          <button
            type="button"
            onClick={() => setImageLightbox(true)}
            data-fb-label="Image du post · Détail du post"
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "zoom-in",
              display: "block",
              maxWidth: "100%",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={postData.imageUrl}
              alt=""
              style={{
                // Plafonné à 520px mais jamais plus large que la carte.
                maxWidth: "min(520px, 100%)",
                maxHeight: 420,
                borderRadius: 12,
                border: "1px solid var(--color-border-default)",
                objectFit: "cover",
                display: "block",
              }}
              loading="lazy"
            />
          </button>
        )}

        {postData.videoUrl && (
          <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "16/9" }}>
            <iframe
              src={`https://www.youtube.com/embed/${postData.videoUrl.split("v=")[1]?.split("&")[0] ?? ""}`}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Reactions */}
        <div data-fb-label="Barre de réactions · Détail du post" style={{ paddingTop: 4, borderTop: "1px solid var(--color-border-default)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <ReactionsBar reactions={reactions} onReact={handleReaction} />
          <ReactionPicker onSelect={handleReaction} mode="post" selectedEmojis={reactions.filter((r) => r.userReacted).map((r) => r.emoji)} />
        </div>
      </article>

      {/* Comments */}
      <div
        id="comments"
        data-fb-label="Encadré commentaires · Détail du post"
        style={{
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "var(--nc-shadow-3)",
        }}
      >
        <CommentList
          postId={post.id}
          comments={comments}
          currentUser={currentUser}
          devRole={devRole}
        />
      </div>
    </div>

    {imageLightbox && postData.imageUrl && (
      <ImageLightbox
        url={postData.imageUrl}
        alt={postData.title ?? ""}
        onClose={() => setImageLightbox(false)}
      />
    )}

    {showEditComposer && (
      <PostComposerModal
        currentUser={currentUser}
        initialPost={postData}
        publishing={editing}
        onClose={() => setShowEditComposer(false)}
        onPublish={(updated) => {
          const titleNormalized = (updated.title ?? "").trim();
          const bodyNormalized = (updated.body ?? "").trim();
          if (!titleNormalized || !bodyNormalized) return;

          startEdit(async () => {
            const result = await updatePostAction(post.id, {
              title: titleNormalized,
              body: bodyNormalized,
              tag: updated.tag,
              audience: updated.audience,
              pinned: updated.pinned,
              image_url: updated.imageUrl ?? null,
              video_url: updated.videoUrl ?? null,
            });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            setPostData((prev) => ({
              ...prev,
              title: titleNormalized,
              body: bodyNormalized,
              tag: updated.tag ?? prev.tag,
              audience: updated.audience ?? prev.audience,
              pinned: updated.pinned ?? prev.pinned,
              imageUrl: updated.imageUrl ?? prev.imageUrl,
              updatedAt: new Date().toISOString(),
            }));
            setShowEditComposer(false);
            toast.success("Post modifié");
            router.refresh();
          });
        }}
      />
    )}
    </>
  );
}
