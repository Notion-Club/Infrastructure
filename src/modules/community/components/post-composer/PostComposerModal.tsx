"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Image as ImageIcon, Video as VideoIcon, Link, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Post, PostTag, PostAudience } from "../../types/post.types";
import type { User } from "../../types/user.types";
import { PostComposerTagSelect } from "./PostComposerTagSelect";
import { PostComposerAdminFields } from "./PostComposerAdminFields";
import { uploadPostMediaAction } from "../../server/actions";
import {
  POST_MEDIA_ALLOWED_MIME,
  POST_MEDIA_MAX_BYTES,
  isAllowedPostMediaMime,
} from "../../lib/validation";

const DRAFT_KEY = "community:draft";

function detectVideoUrl(text: string): { type: "youtube" | "loom" | "tella"; src: string } | null {
  const ytMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return { type: "youtube", src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  const loomMatch = text.match(/https?:\/\/(?:www\.)?loom\.com\/share\/([a-z0-9]+)/i);
  if (loomMatch) return { type: "loom", src: `https://www.loom.com/embed/${loomMatch[1]}` };
  const tellaMatch = text.match(/https?:\/\/(?:www\.)?tella\.tv\/video\/([^?\s]+)/i);
  if (tellaMatch) return { type: "tella", src: `https://www.tella.tv/video/${tellaMatch[1]}/embed` };
  return null;
}

interface PostComposerModalProps {
  currentUser: User;
  onClose: () => void;
  onPublish: (post: Partial<Post>) => void;
  initialPost?: Partial<Post>;
  // true pendant que la Server Action createPostAction est en cours —
  // disable le bouton Publier pour éviter les double-clics.
  publishing?: boolean;
}

export function PostComposerModal({ currentUser, onClose, onPublish, initialPost, publishing = false }: PostComposerModalProps) {
  const isAdmin = currentUser.role === "admin" || currentUser.role === "mentor";
  const isEditMode = !!initialPost;

  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [bodyHtml, setBodyHtml] = useState(initialPost?.body ?? "");
  const [tag, setTag] = useState<PostTag>(initialPost?.tag ?? "general");
  const [audience, setAudience] = useState<PostAudience | null>(
    isEditMode ? (initialPost?.audience ?? "all") : isAdmin ? null : "all"
  );
  const [pinned, setPinned] = useState(initialPost?.pinned ?? false);
  const [pinnedDuration, setPinnedDuration] = useState("24h");
  const [notifyAll, setNotifyAll] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [urlMenuVisible, setUrlMenuVisible] = useState(false);
  const [urlMenuPos, setUrlMenuPos] = useState({ top: 0, left: 0 });
  const [urlNoSelection, setUrlNoSelection] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(initialPost?.imageUrl ?? null);
  const [editorEmpty, setEditorEmpty] = useState(!initialPost?.body);
  const [videoPreview, setVideoPreview] = useState<{ type: string; src: string } | null>(null);
  const [boldActive, setBoldActive] = useState(false);
  const [italicActive, setItalicActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Restore draft (only when not editing) — dépend de `mounted` car le
  // portail n'est rendu qu'après le premier setMounted(true), donc
  // editorRef.current n'existe pas avant.
  useEffect(() => {
    if (!mounted) return;
    if (isEditMode) {
      if (editorRef.current && initialPost?.body) {
        // initialPost.body est du plain text (cf. handlePublish qui stocke
        // innerText). textContent préserve les retours à la ligne et évite
        // toute injection HTML accidentelle.
        editorRef.current.textContent = initialPost.body;
        setBodyHtml(editorRef.current.innerHTML);
        setEditorEmpty(initialPost.body.trim().length === 0);
        const video = detectVideoUrl(initialPost.body);
        if (video) setVideoPreview(video);
      }
      return;
    }
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.tag) setTag(draft.tag);
        if (draft.bodyHtml && editorRef.current) {
          editorRef.current.innerHTML = draft.bodyHtml;
          setBodyHtml(draft.bodyHtml);
          setEditorEmpty(editorRef.current.innerText.trim().length === 0);
          const video = detectVideoUrl(editorRef.current.innerText);
          if (video) setVideoPreview(video);
        }
      }
    } catch {}
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (canPublish) handlePublish();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Track bold/italic active state on selection changes
  useEffect(() => {
    function onSelectionChange() {
      setBoldActive(document.queryCommandState("bold"));
      setItalicActive(document.queryCommandState("italic"));
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  function syncBody() {
    const html = editorRef.current?.innerHTML ?? "";
    const text = editorRef.current?.innerText?.trim() ?? "";
    setBodyHtml(html);
    setEditorEmpty(text.length === 0);
    const video = detectVideoUrl(text);
    setVideoPreview(video);
  }

  const editorHasContent = !editorEmpty;
  const canPublish = editorHasContent && (isAdmin ? audience !== null : true);

  function handlePublish() {
    if (!canPublish) return;
    if (!isEditMode) {
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    }
    onPublish({
      ...initialPost,
      title: title.trim() || undefined,
      body: editorRef.current?.innerText?.trim() ?? "",
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

  const handleUrlButtonClick = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setUrlNoSelection(true);
      setTimeout(() => setUrlNoSelection(false), 2000);
      return;
    }
    savedRange.current = sel.getRangeAt(0).cloneRange();
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    // Position above the selection
    setUrlMenuPos({ top: rect.top - 60, left: Math.max(8, rect.left) });
    setUrlMenuVisible(true);
    setUrlInput("");
    setUrlNoSelection(false);
  }, []);

  function insertLink() {
    if (!savedRange.current || !urlInput.trim()) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand("createLink", false, urlInput.trim());
    setUrlMenuVisible(false);
    editorRef.current?.focus();
    syncBody();
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await uploadImage(file);
  }

  async function uploadImage(file: File) {
    if (!isAllowedPostMediaMime(file.type)) {
      toast.error(`Format non supporté. Utilise ${POST_MEDIA_ALLOWED_MIME.join(", ")}.`);
      return;
    }
    if (file.size > POST_MEDIA_MAX_BYTES) {
      toast.error(`Le fichier dépasse ${Math.round(POST_MEDIA_MAX_BYTES / 1024 / 1024)} MB.`);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadPostMediaAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // Replace previous image (no revokeObjectURL needed — the URL est
      // désormais une URL publique Supabase, pas un blob local).
      setPendingImageUrl(result.publicUrl);
    } finally {
      setUploading(false);
    }
  }

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* URL floating input */}
      {urlMenuVisible && (
        <div
          style={{
            position: "fixed",
            top: urlMenuPos.top,
            left: urlMenuPos.left,
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            boxShadow: "var(--nc-shadow-3)",
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            zIndex: 10002,
            animation: "nc-mode-in 150ms var(--nc-ease) both",
          }}
        >
          <input
            autoFocus
            type="url"
            placeholder="https://…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); insertLink(); }
              if (e.key === "Escape") setUrlMenuVisible(false);
            }}
            style={{
              border: "1px solid var(--color-border-default)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 13,
              outline: "none",
              width: 220,
              fontFamily: "inherit",
            }}
          />
          <button
            type="button"
            onClick={insertLink}
            style={{
              padding: "6px 12px",
              background: "var(--color-brand)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => setUrlMenuVisible(false)}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "none", background: "transparent",
              cursor: "pointer", color: "var(--color-text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          background: "var(--color-surface-card)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 580,
          maxHeight: "90dvh",
          overflowY: "auto",
          animation: "nc-mode-in var(--nc-duration-fast) var(--nc-ease) both",
          display: "flex",
          flexDirection: "column",
        }}
        className="md:max-h-[80dvh]"
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--color-border-default)",
          flexShrink: 0,
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
          <input
            type="text"
            placeholder="Titre (optionnel)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12, fontSize: 15, fontWeight: 600,
              outline: "none", background: "var(--color-surface-raised)",
              color: "var(--color-text-primary)", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--color-border-default)")}
          />

          {/* Pending image preview */}
          {pendingImageUrl && (
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
              <img
                src={pendingImageUrl}
                alt="preview"
                style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
              />
              <button
                type="button"
                onClick={() => { URL.revokeObjectURL(pendingImageUrl); setPendingImageUrl(null); }}
                style={{
                  position: "absolute", top: 8, right: 8,
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Video preview */}
          {videoPreview && (
            <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "16/9" }}>
              <iframe
                src={videoPreview.src}
                style={{ width: "100%", height: "100%", border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Editor */}
          <div
            style={{
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Toolbar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "8px 10px", borderBottom: "1px solid var(--color-border-default)",
              background: "var(--color-surface-raised)",
            }}>
              <button
                type="button"
                title="Gras"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { document.execCommand("bold", false); editorRef.current?.focus(); syncBody(); }}
                style={{
                  fontWeight: 700, width: 30, height: 30, borderRadius: 6, border: "none",
                  background: boldActive ? "rgba(0,0,0,0.10)" : "transparent",
                  color: boldActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  cursor: "pointer", fontSize: 14, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  transition: "background 100ms ease",
                }}
                className="hover:bg-[rgba(0,0,0,0.06)]"
              >
                B
              </button>
              <button
                type="button"
                title="Italique"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { document.execCommand("italic", false); editorRef.current?.focus(); syncBody(); }}
                style={{
                  fontStyle: "italic", width: 30, height: 30, borderRadius: 6, border: "none",
                  background: italicActive ? "rgba(0,0,0,0.10)" : "transparent",
                  color: italicActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  cursor: "pointer", fontSize: 14, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  transition: "background 100ms ease",
                }}
                className="hover:bg-[rgba(0,0,0,0.06)]"
              >
                I
              </button>
              <span style={{ width: 1, height: 16, background: "var(--color-border-default)" }} />
              <button
                type="button"
                title="Liste"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { document.execCommand("insertUnorderedList", false); editorRef.current?.focus(); syncBody(); }}
                style={{
                  width: 30, height: 30, borderRadius: 6, border: "none", background: "transparent",
                  cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)",
                  transition: "background 100ms ease", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                className="hover:bg-[rgba(0,0,0,0.06)]"
              >
                ≡
              </button>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  title="Lien"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleUrlButtonClick}
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: "none", background: "transparent",
                    cursor: "pointer", color: "var(--color-text-secondary)",
                    transition: "background 100ms ease", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  className="hover:bg-[rgba(0,0,0,0.06)]"
                >
                  <Link size={14} />
                </button>
                {urlNoSelection && (
                  <div style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--nc-btn-dark-bg)",
                    color: "var(--nc-btn-dark-text)",
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "5px 10px",
                    borderRadius: 8,
                    whiteSpace: "nowrap",
                    zIndex: 10003,
                    pointerEvents: "none",
                    animation: "nc-mode-in 150ms var(--nc-ease) both",
                  }}>
                    Sélectionne du texte pour ajouter un lien
                  </div>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageFile}
              />
              <button
                type="button"
                title={uploading ? "Upload en cours…" : "Image"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => !uploading && imageInputRef.current?.click()}
                disabled={uploading}
                style={{
                  width: 30, height: 30, borderRadius: 6, border: "none", background: "transparent",
                  cursor: uploading ? "not-allowed" : "pointer",
                  color: uploading ? "var(--color-text-muted)" : "var(--color-text-secondary)",
                  opacity: uploading ? 0.5 : 1,
                  transition: "background 100ms ease", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                className={uploading ? "" : "hover:bg-[rgba(0,0,0,0.06)]"}
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
              </button>
              <button
                type="button"
                title="Vidéo (YouTube, Tella, Loom)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const url = window.prompt("URL de la vidéo (YouTube, Tella, Loom)");
                  if (url) {
                    editorRef.current?.focus();
                    document.execCommand("insertText", false, url);
                    syncBody();
                  }
                }}
                style={{
                  width: 30, height: 30, borderRadius: 6, border: "none", background: "transparent",
                  cursor: "pointer", color: "var(--color-text-secondary)",
                  transition: "background 100ms ease", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                className="hover:bg-[rgba(0,0,0,0.06)]"
              >
                <VideoIcon size={14} />
              </button>
            </div>

            {/* contentEditable editor */}
            <div style={{ position: "relative" }}>
              {editorEmpty && (
                <span
                  style={{
                    position: "absolute",
                    top: 14, left: 14,
                    color: "var(--color-text-muted)",
                    fontSize: 14,
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  Partagez quelque chose avec la communauté…
                </span>
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncBody}
                style={{
                  minHeight: 120,
                  padding: "14px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  lineHeight: 1.6,
                  color: "var(--color-text-primary)",
                  outline: "none",
                  wordBreak: "break-word",
                }}
              />
            </div>
          </div>

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

          {isAdmin && audience === null && editorHasContent && (
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
          flexShrink: 0,
          background: "var(--color-surface-card)",
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
            disabled={!canPublish || publishing}
            style={{
              padding: "9px 24px",
              background: canPublish && !publishing ? "var(--color-brand)" : "var(--color-border-default)",
              color: canPublish && !publishing ? "#fff" : "var(--color-text-muted)",
              border: "none", borderRadius: 9999, fontSize: 14, fontWeight: 600,
              cursor: canPublish && !publishing ? "pointer" : "not-allowed",
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
  return createPortal(modal, document.body);
}
