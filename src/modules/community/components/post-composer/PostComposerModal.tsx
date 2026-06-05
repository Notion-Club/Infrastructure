"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Post, PostTag, PostAudience } from "../../types/post.types";
import type { User } from "../../types/user.types";
import { PostComposerTagSelect } from "./PostComposerTagSelect";
import { PostComposerAdminFields } from "./PostComposerAdminFields";
import { ImageLightbox } from "../shared/ImageLightbox";
import { uploadPostMediaAction, deletePostMediaAction } from "../../server/actions";
import {
  POST_MEDIA_ALLOWED_MIME,
  POST_MEDIA_MAX_BYTES,
  isAllowedPostMediaMime,
} from "../../lib/validation";
import { RichTextEditor } from "@/shared/components/editor/RichTextEditor";

const DRAFT_KEY = "community:draft";

interface PostComposerModalProps {
  currentUser: User;
  onClose: () => void;
  onPublish: (post: Partial<Post>) => void;
  initialPost?: Partial<Post>;
  publishing?: boolean;
}

export function PostComposerModal({ currentUser, onClose, onPublish, initialPost, publishing = false }: PostComposerModalProps) {
  const isAdmin = currentUser.role === "admin" || currentUser.role === "mentor";
  const isEditMode = !!initialPost;

  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [bodyHtml, setBodyHtml] = useState(initialPost?.body ?? "");
  const [bodyEmpty, setBodyEmpty] = useState(!(initialPost?.body));
  const [tag, setTag] = useState<PostTag>(initialPost?.tag ?? "general");
  const [audience, setAudience] = useState<PostAudience | null>(
    isEditMode ? (initialPost?.audience ?? "all") : isAdmin ? null : "all"
  );
  const [pinned, setPinned] = useState(initialPost?.pinned ?? false);
  const [pinnedDuration, setPinnedDuration] = useState("24h");
  const [notifyAll, setNotifyAll] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(initialPost?.imageUrl ?? null);
  const [pendingImagePath, setPendingImagePath] = useState<string | null>(null);
  const [previewLightbox, setPreviewLightbox] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [mounted, setMounted] = useState(false);
  // resetKey forces RichTextEditor to re-mount its content on draft restore
  const [resetKey, setResetKey] = useState(0);
  const [draftContent, setDraftContent] = useState<string | undefined>(undefined);

  useEffect(() => { setMounted(true); }, []);

  // Restore draft (only when not editing)
  useEffect(() => {
    if (!mounted) return;
    if (isEditMode) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.tag) setTag(draft.tag);
        if (draft.bodyHtml) {
          setDraftContent(draft.bodyHtml);
          setBodyHtml(draft.bodyHtml);
          setBodyEmpty(false);
          setResetKey((k) => k + 1);
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Save draft on change (only when not editing)
  useEffect(() => {
    if (isEditMode) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, bodyHtml, tag }));
    } catch {}
  }, [title, bodyHtml, tag, isEditMode]);

  // Esc to close, Cmd/Ctrl+Enter to publish
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePublish();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, bodyHtml, title]);

  const titleHasContent = title.trim().length > 0;
  const canPublish = titleHasContent && !bodyEmpty && (isAdmin ? audience !== null : true);
  const titleError = submitAttempted && !titleHasContent;
  const bodyError = submitAttempted && bodyEmpty;

  function handlePublish() {
    if (!canPublish) {
      setSubmitAttempted(true);
      return;
    }
    if (!isEditMode) {
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    }
    onPublish({
      ...initialPost,
      title: title.trim(),
      body: bodyHtml,
      tag,
      audience: audience ?? "all",
      pinned,
      imageUrl: pendingImageUrl ?? undefined,
      author: currentUser,
      reactions: initialPost?.reactions ?? [],
      commentCount: initialPost?.commentCount ?? 0,
      createdAt: initialPost?.createdAt ?? new Date().toISOString(),
    });
  }

  async function handleImageUpload(file: File): Promise<string | null> {
    if (!isAllowedPostMediaMime(file.type)) {
      toast.error(`Format non supporté. Utilise ${POST_MEDIA_ALLOWED_MIME.join(", ")}.`);
      return null;
    }
    if (file.size > POST_MEDIA_MAX_BYTES) {
      toast.error(`Le fichier dépasse ${Math.round(POST_MEDIA_MAX_BYTES / 1024 / 1024)} MB.`);
      return null;
    }
    // Attachment image (cover) — stored separately from inline body images
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadPostMediaAction(formData);
    if (!result.ok) {
      toast.error(result.message);
      return null;
    }
    if (pendingImagePath) {
      deletePostMediaAction(pendingImagePath).catch(() => {});
    }
    setPendingImageUrl(result.publicUrl);
    setPendingImagePath(result.storagePath);
    return result.publicUrl;
  }

  const modal = (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--color-surface-card)", borderRadius: 20,
          width: "100%", maxWidth: 580, maxHeight: "90dvh", overflowY: "auto",
          animation: "nc-mode-in var(--nc-duration-fast) var(--nc-ease) both",
          display: "flex", flexDirection: "column",
        }}
        className="md:max-h-[80dvh]"
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--color-border-default)", flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)" }}>
            {isEditMode ? "Modifier le post" : "Que souhaites-tu partager ?"}
          </h2>
          <button type="button" onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", display: "flex", borderRadius: "50%", padding: 4 }}
            className="hover:bg-[rgba(0,0,0,0.06)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              type="text"
              data-nc-field="post-title"
              placeholder="Titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleError}
              style={{
                width: "100%", padding: "10px 14px",
                border: `1px solid ${titleError ? "var(--color-brand)" : "var(--color-border-default)"}`,
                borderRadius: 12, fontSize: 15, fontWeight: 600,
                outline: "none", background: "var(--color-surface-raised)",
                color: "var(--color-text-primary)", fontFamily: "inherit",
                boxSizing: "border-box", transition: "border-color 150ms ease",
              }}
              onFocus={(e) => { if (!titleError) e.target.style.borderColor = "var(--color-brand)"; }}
              onBlur={(e) => { if (!titleError) e.target.style.borderColor = "var(--color-border-default)"; }}
            />
            {titleError && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-brand)", paddingLeft: 4 }}>
                Le titre est obligatoire
              </p>
            )}
          </div>

          {/* Rich text editor */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                border: `1px solid ${bodyError ? "var(--color-brand)" : "var(--color-border-default)"}`,
                borderRadius: 12, overflow: "hidden",
                transition: "border-color 150ms ease",
              }}
              onFocusCapture={(e) => {
                const el = e.currentTarget;
                if (!bodyError) el.style.borderColor = "var(--color-brand)";
              }}
              onBlurCapture={(e) => {
                const el = e.currentTarget;
                if (!bodyError) el.style.borderColor = "var(--color-border-default)";
              }}
            >
              <RichTextEditor
                key={resetKey}
                placeholder="Partagez quelque chose avec la communauté…"
                initialContent={draftContent ?? (isEditMode ? (initialPost?.body ?? "") : "")}
                minHeight={120}
                autoFocus={false}
                onImageUpload={handleImageUpload}
                onChange={(html, isEmpty) => {
                  setBodyHtml(html);
                  setBodyEmpty(isEmpty);
                }}
              />
            </div>
            {bodyError && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-brand)", paddingLeft: 4 }}>
                Le contenu du post est obligatoire
              </p>
            )}
          </div>

          {/* Cover image preview */}
          {pendingImageUrl && (
            <div style={{ position: "relative", display: "inline-block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImageUrl}
                alt="preview"
                onClick={() => setPreviewLightbox(true)}
                style={{
                  maxWidth: 320, maxHeight: 240, borderRadius: 10,
                  border: "1px solid var(--color-border-default)",
                  objectFit: "cover", display: "block", cursor: "zoom-in",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (pendingImagePath) deletePostMediaAction(pendingImagePath).catch(() => {});
                  setPendingImageUrl(null);
                  setPendingImagePath(null);
                }}
                aria-label="Retirer l'image"
                style={{
                  position: "absolute", top: 6, right: 6,
                  width: 24, height: 24, borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 12,
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Tag */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>Tag :</span>
            <PostComposerTagSelect value={tag} onChange={setTag} isAdmin={isAdmin} />
          </div>

          {/* Admin fields */}
          {isAdmin && (
            <PostComposerAdminFields
              audience={audience}
              onAudienceChange={setAudience}
              pinned={pinned}
              onPinnedChange={setPinned}
              pinnedDuration={pinnedDuration}
              onPinnedDurationChange={setPinnedDuration}
              notifyAll={notifyAll}
              onNotifyAllChange={setNotifyAll}
            />
          )}

          {isAdmin && audience === null && !bodyEmpty && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-brand)", textAlign: "center" }}>
              Sélectionnez une audience pour pouvoir publier.
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10,
          padding: "14px 20px",
          borderTop: "1px solid var(--color-border-default)",
          flexShrink: 0, background: "var(--color-surface-card)",
        }}>
          <button type="button" onClick={onClose}
            style={{
              padding: "9px 20px", border: "1px solid var(--color-border-default)",
              background: "transparent", borderRadius: 9999, fontSize: 14, fontWeight: 500,
              cursor: "pointer", color: "var(--color-text-secondary)", transition: "background 150ms ease",
            }}
            className="hover:bg-[var(--nc-nav-hover-bg)]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            style={{
              padding: "9px 24px",
              background: !publishing ? "var(--color-brand)" : "var(--color-border-default)",
              color: !publishing ? "#fff" : "var(--color-text-muted)",
              border: "none", borderRadius: 9999, fontSize: 14, fontWeight: 600,
              cursor: !publishing ? "pointer" : "not-allowed",
              transition: "all 150ms ease",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            {publishing && <Loader2 size={14} className="animate-spin" />}
            {publishing
              ? (isEditMode ? "Sauvegarde…" : "Publication…")
              : (isEditMode ? "Sauvegarder" : "Publier")}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(
    <>
      {modal}
      {previewLightbox && pendingImageUrl && (
        <ImageLightbox
          url={pendingImageUrl}
          alt="Aperçu de l'image en cours de publication"
          onClose={() => setPreviewLightbox(false)}
        />
      )}
    </>,
    document.body,
  );
}
