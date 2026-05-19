"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
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
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<PostTag>("general");
  const [audience, setAudience] = useState<PostAudience | null>(isAdmin ? null : "all");
  const [pinned, setPinned] = useState(false);
  const [pinnedDuration, setPinnedDuration] = useState("24h");
  const [notifyAll, setNotifyAll] = useState(false);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);

  // Restore draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.body) setBody(draft.body);
        if (draft.tag) setTag(draft.tag);
      }
    } catch {}
  }, []);

  // Save draft on change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body, tag }));
    } catch {}
  }, [title, body, tag]);

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canPublish = body.trim().length > 0 && (isAdmin ? audience !== null : true);

  function handlePublish() {
    if (!canPublish) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    onPublish({
      title: title.trim() || undefined,
      body: body.trim(),
      tag,
      audience: audience ?? "all",
      pinned,
      author: currentUser,
      reactions: [],
      commentCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  const wrapText = useCallback((wrapper: string) => {
    setBody((prev) => {
      const textarea = document.querySelector<HTMLTextAreaElement>("#composer-body");
      if (!textarea) return `${wrapper}${prev}${wrapper}`;
      const { selectionStart: s, selectionEnd: e } = textarea;
      if (s === e) return prev;
      const selected = prev.slice(s, e);
      return prev.slice(0, s) + `${wrapper}${selected}${wrapper}` + prev.slice(e);
    });
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
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
            Nouveau post
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
              {[
                { label: "B", title: "Gras", action: () => { setBold((b) => !b); wrapText("**"); }, active: bold, style: { fontWeight: 700 } },
                { label: "I", title: "Italique", action: () => { setItalic((i) => !i); wrapText("_"); }, active: italic, style: { fontStyle: "italic" } },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  title={btn.title}
                  onClick={btn.action}
                  style={{
                    ...btn.style,
                    width: 30, height: 30, borderRadius: 6, border: "none",
                    background: btn.active ? "rgba(224,98,90,0.1)" : "transparent",
                    color: btn.active ? "var(--color-brand)" : "var(--color-text-secondary)",
                    cursor: "pointer", fontSize: 14, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    transition: "background 100ms ease",
                  }}
                  className="hover:bg-[rgba(0,0,0,0.06)]"
                >
                  {btn.label}
                </button>
              ))}
              <span style={{ width: 1, height: 16, background: "var(--color-border-default)" }} />
              <button type="button" title="Liste" onClick={() => setBody((b) => b + "\n• ")}
                style={{ width: 30, height: 30, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)", transition: "background 100ms ease" }}
                className="hover:bg-[rgba(0,0,0,0.06)]">
                ≡
              </button>
              <button type="button" title="Lien" onClick={() => setBody((b) => b + "[texte](url)")}
                style={{ width: 30, height: 30, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600, transition: "background 100ms ease" }}
                className="hover:bg-[rgba(0,0,0,0.06)]">
                🔗
              </button>
              <button type="button" title="Image" onClick={() => setBody((b) => b + "\n![image](url)")}
                style={{ width: 30, height: 30, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 14, transition: "background 100ms ease" }}
                className="hover:bg-[rgba(0,0,0,0.06)]">
                📎
              </button>
              <button type="button" title="Vidéo" onClick={() => {
                const url = window.prompt("URL de la vidéo (YouTube, Tella, Loom)");
                if (url) setBody((b) => b + `\n[vidéo: ${url}]`);
              }}
                style={{ width: 30, height: 30, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 14, transition: "background 100ms ease" }}
                className="hover:bg-[rgba(0,0,0,0.06)]">
                🎥
              </button>
            </div>

            <textarea
              id="composer-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Partagez quelque chose avec la communauté…"
              rows={6}
              style={{
                width: "100%", padding: "14px", border: "none",
                fontSize: 14, resize: "none", outline: "none",
                fontFamily: "inherit", lineHeight: 1.6,
                color: "var(--color-text-primary)", boxSizing: "border-box",
                background: "white",
              }}
            />
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

          {isAdmin && audience === null && body.trim() && (
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
