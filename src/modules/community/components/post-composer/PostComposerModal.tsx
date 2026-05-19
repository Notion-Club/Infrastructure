"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Image as ImageIcon, Video as VideoIcon, Link } from "lucide-react";
import type { Post, PostTag, PostAudience } from "../../types/post.types";
import type { User } from "../../types/user.types";
import { PostComposerTagSelect } from "./PostComposerTagSelect";
import { PostComposerAdminFields } from "./PostComposerAdminFields";

const DRAFT_KEY = "community:draft";

interface PostComposerModalProps {
  currentUser: User;
  onClose: () => void;
  onPublish: (post: Partial<Post>) => void;
}

export function PostComposerModal({ currentUser, onClose, onPublish }: PostComposerModalProps) {
  const isAdmin = currentUser.role === "admin" || currentUser.role === "mentor";

  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [tag, setTag] = useState<PostTag>("general");
  const [audience, setAudience] = useState<PostAudience | null>(isAdmin ? null : "all");
  const [pinned, setPinned] = useState(false);
  const [pinnedDuration, setPinnedDuration] = useState("24h");
  const [notifyAll, setNotifyAll] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [urlMenuVisible, setUrlMenuVisible] = useState(false);
  const [urlMenuPos, setUrlMenuPos] = useState({ top: 0, left: 0 });
  const [urlInput, setUrlInput] = useState("");
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);

  // Restore draft
  useEffect(() => {
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
        }
      }
    } catch {}
  }, []);

  // Save draft on change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, bodyHtml, tag }));
    } catch {}
  }, [title, bodyHtml, tag]);

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function syncBody() {
    const html = editorRef.current?.innerHTML ?? "";
    const text = editorRef.current?.innerText?.trim() ?? "";
    setBodyHtml(html);
    setEditorEmpty(text.length === 0);
  }

  const editorHasContent = !editorEmpty;
  const canPublish = editorHasContent && (isAdmin ? audience !== null : true);

  function handlePublish() {
    if (!canPublish) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    onPublish({
      title: title.trim() || undefined,
      body: editorRef.current?.innerText?.trim() ?? "",
      tag,
      audience: audience ?? "all",
      pinned,
      imageUrl: pendingImageUrl ?? undefined,
      author: currentUser,
      reactions: [],
      commentCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  const handleUrlButtonClick = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setUrlMenuPos({ top: rect.top - 52, left: rect.left });
    setUrlMenuVisible(true);
    setUrlInput("");
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

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setPendingImageUrl(URL.createObjectURL(file));
    e.target.value = "";
  }

  return (
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
            background: "white",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            boxShadow: "var(--nc-shadow-3)",
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            zIndex: 10001,
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
          background: "white",
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
            Que souhaites-tu partager ?
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
                  background: "transparent", color: "var(--color-text-secondary)",
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
                  background: "transparent", color: "var(--color-text-secondary)",
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
              <button
                type="button"
                title="Lien (sélectionnez du texte d'abord)"
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
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageFile}
              />
              <button
                type="button"
                title="Image"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => imageInputRef.current?.click()}
                style={{
                  width: 30, height: 30, borderRadius: 6, border: "none", background: "transparent",
                  cursor: "pointer", color: "var(--color-text-secondary)",
                  transition: "background 100ms ease", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                className="hover:bg-[rgba(0,0,0,0.06)]"
              >
                <ImageIcon size={14} />
              </button>
              <button
                type="button"
                title="Vidéo"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const url = window.prompt("URL de la vidéo (YouTube, Tella, Loom)");
                  if (url) {
                    editorRef.current?.focus();
                    document.execCommand("insertText", false, `[vidéo: ${url}]`);
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
          background: "white",
        }}>
          <button type="button" onClick={onClose}
            style={{
              padding: "9px 20px", border: "1px solid var(--color-border-default)",
              background: "white", borderRadius: 9999, fontSize: 14, fontWeight: 500,
              cursor: "pointer", color: "var(--color-text-secondary)", transition: "background 150ms ease",
            }}
            className="hover:bg-[rgba(0,0,0,0.04)]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish}
            className={canPublish ? "nc-btn-shine" : ""}
            style={{
              padding: "9px 24px",
              background: canPublish ? "var(--color-brand)" : "#e5e7eb",
              color: canPublish ? "#fff" : "#9ca3af",
              border: "none", borderRadius: 9999, fontSize: 14, fontWeight: 600,
              cursor: canPublish ? "pointer" : "not-allowed",
              transition: "all 150ms ease",
            }}
          >
            Publier
          </button>
        </div>
      </div>
    </div>
  );
}
