"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Post } from "../../types/post.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { fullDateTime, timeAgo, wasEdited } from "../../utils/date-helpers";
import { renderBodyRich } from "../../utils/render-mentions";
import { buildPostLink, copyCommunityLink } from "../../utils/copy-link";
import { UserAvatar } from "../shared/UserAvatar";
import { UserHoverCard } from "../shared/UserHoverCard";
import { TagPill } from "../shared/TagPill";
import { ReactionsBar } from "../shared/ReactionsBar";
import { PostKebabMenu } from "../shared/PostKebabMenu";
import { PostComposerModal } from "../post-composer/PostComposerModal";
import { DeletePostConfirmDialog } from "../shared/DeletePostConfirmDialog";
import { ImageLightbox } from "../shared/ImageLightbox";
import {
  deletePostAction,
  togglePostReactionAction,
  updatePostAction,
} from "../../server/actions";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageLightbox, setImageLightbox] = useState(false);
  // Menu kebab ouvert → on élève la carte au-dessus des voisines pour que le
  // dropdown (qui déborde vers le bas) ne passe pas sous la carte suivante.
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, startEdit] = useTransition();
  const isAuthor = post.author.id === currentUser.id;
  const isPrivileged = currentUser.role === "admin" || currentUser.role === "mentor";
  const edited = wasEdited(postData.createdAt, postData.updatedAt);

  function handleCardClick() {
    try { sessionStorage.setItem("communaute:scrollY", String(window.scrollY)); } catch {}
    router.push(`/communaute/post/${post.id}`);
  }

  async function handleReaction(emoji: string) {
    // Optimistic update : on toggle local immédiatement pour le feedback,
    // puis on appelle la Server Action. Si elle échoue, on revert.
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
    router.refresh();
  }

  // Admin/mentor only — la RLS 021 (posts_update_with_guard) bloquera tout
  // membre standard qui tenterait pinned=true via le client. Optimistic local
  // pour le feedback, revert sur erreur.
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
    <article
      onClick={handleCardClick}
      data-fb-label="Carte post · Feed"
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
        viewTransitionName: `post-card-${post.id}`,
        // Contexte d'empilement local : quand le menu kebab est ouvert, la carte
        // remonte au-dessus des cartes suivantes pour que le dropdown débordant
        // reste visible (flex-item → z-index effectif sans position, mais on pose
        // position:relative pour être robuste au contexte viewTransitionName).
        position: "relative",
        zIndex: menuOpen ? 20 : undefined,
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
              data-fb-label="Avatar auteur · Carte post"
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
                  data-fb-label="Lien auteur · Carte post"
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
            <p
              style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}
              title={`Publié le ${fullDateTime(postData.createdAt)}${edited ? ` · modifié le ${fullDateTime(postData.updatedAt)}` : ""}`}
            >
              {timeAgo(postData.createdAt)}
              {edited && (
                <>
                  {" · "}
                  <span style={{ fontStyle: "italic" }}>modifié</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Menu toujours affiché : "Copier le lien" est accessible à tous ;
            édition/suppression/épinglage restent gardés par les droits. */}
        <div data-fb-label="Menu options du post · Carte post" onClick={(e) => e.stopPropagation()}>
          <PostKebabMenu
            onCopyLink={() => copyCommunityLink(buildPostLink(post.id))}
            onEdit={isAuthor ? () => setShowEditComposer(true) : undefined}
            onDelete={isAuthor || isPrivileged ? () => setShowDeleteConfirm(true) : undefined}
            onTogglePin={isPrivileged ? handleTogglePin : undefined}
            pinned={postData.pinned}
            onOpenChange={setMenuOpen}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {postData.title && (
          <h2
            data-fb-label="Titre du post · Carte post"
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
        <div
          style={{
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
          {renderBodyRich(postData.body, postData.mentions)}
        </div>

        {postData.imageUrl && (
          /* Slack-like : preview modérée + click ouvre lightbox plein écran.
             stopPropagation évite la navigation vers la page détail. */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setImageLightbox(true);
            }}
            data-fb-label="Image du post · Carte post"
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "zoom-in",
              marginTop: 4,
              display: "block",
              maxWidth: "100%",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={postData.imageUrl}
              alt=""
              style={{
                // `min(380px, 100%)` : plafonné à 380px sur grand écran mais
                // jamais plus large que la carte (sinon l'image débordait à
                // droite sur mobile, le conteneur étant < 380px).
                maxWidth: "min(380px, 100%)",
                maxHeight: 320,
                borderRadius: 10,
                border: "1px solid var(--color-border-default)",
                objectFit: "cover",
                display: "block",
              }}
              loading="lazy"
            />
          </button>
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
      <div data-fb-label="Barre de réactions · Carte post" onClick={(e) => e.stopPropagation()}>
        <ReactionsBar
          reactions={reactions}
          commentCount={postData.commentCount}
          compact
          onReact={handleReaction}
          onCommentClick={() => router.push(`/communaute/post/${post.id}#comments`)}
        />
      </div>
    </article>

    {showDeleteConfirm && (
      <DeletePostConfirmDialog
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    )}

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
            // Optimistic local update — l'updatedAt sera resynchronisé
            // proprement au prochain router.refresh() (qui re-fetch listPosts).
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
