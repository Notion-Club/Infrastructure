"use client";

import { useState, useRef, useEffect } from "react";
import { Bold, Italic, List, Link, Image as ImageIcon } from "lucide-react";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { MOCK_USERS } from "../../mocks/users.mock";
import { canMentionUser } from "../../utils/mention-rules";
import { UserAvatar } from "../shared/UserAvatar";

interface CommentComposerProps {
  currentUser: User;
  devRole: DevRole;
  placeholder?: string;
  replyingTo?: string;
  onCancelReply?: () => void;
  onSubmit: (body: string) => void;
  compact?: boolean;
}

export function CommentComposer({
  currentUser,
  placeholder = "Ajouter un commentaire…",
  replyingTo,
  onCancelReply,
  onSubmit,
}: CommentComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [editorFocused, setEditorFocused] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const [urlVisible, setUrlVisible] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlPos, setUrlPos] = useState({ top: 0, left: 0 });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mentionables = MOCK_USERS.filter(
    (u) => !u.deleted && u.id !== currentUser.id && canMentionUser(currentUser, u)
  );

  const suggestions = mentionSearch !== null
    ? mentionables.filter((u) => u.name.toLowerCase().includes(mentionSearch.toLowerCase())).slice(0, 5)
    : [];

  useEffect(() => {
    if (replyingTo && editorRef.current) {
      editorRef.current.innerHTML = `<span style="color:var(--color-brand);font-weight:500">@${replyingTo}</span>&nbsp;`;
      setEditorEmpty(false);
    }
  }, [replyingTo]);

  function syncEmpty() {
    const text = editorRef.current?.innerText?.trim() ?? "";
    setEditorEmpty(text.length === 0);
  }

  function handleInput() {
    syncEmpty();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setMentionSearch(null); return; }
    const range = sel.getRangeAt(0);
    const textBefore = (range.startContainer.textContent ?? "").slice(0, range.startOffset);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      const rect = range.getBoundingClientRect();
      setMentionPos({ top: rect.bottom + 6, left: rect.left });
      setMentionSearch(match[1]);
    } else {
      setMentionSearch(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function insertMention(name: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.textContent ?? "";
      const offset = range.startOffset;
      const match = text.slice(0, offset).match(/@(\w*)$/);
      if (match) {
        const start = offset - match[0].length;
        textNode.textContent = text.slice(0, start) + `@${name} ` + text.slice(offset);
        const newRange = document.createRange();
        newRange.setStart(textNode, start + name.length + 2);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }
    setMentionSearch(null);
    editorRef.current?.focus();
    syncEmpty();
  }

  function handleSubmit() {
    const text = editorRef.current?.innerText?.trim() ?? "";
    if (!text) return;
    onSubmit(text);
    if (editorRef.current) editorRef.current.innerHTML = "";
    setEditorEmpty(true);
    setMentionSearch(null);
  }

  function handleLinkClick() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setUrlPos({ top: rect.top - 52, left: rect.left });
    setUrlVisible(true);
    setUrlInput("");
  }

  function insertLink() {
    if (!savedRange.current || !urlInput.trim()) return;
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
    document.execCommand("createLink", false, urlInput.trim());
    setUrlVisible(false);
    editorRef.current?.focus();
    syncEmpty();
  }

  return (
    <div style={{ display: "flex", gap: 10, position: "relative" }}>
      <UserAvatar user={currentUser} size={36} />
      <div style={{ flex: 1 }}>
        {replyingTo && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--color-text-muted)" }}>
            Réponse à <strong style={{ color: "var(--color-brand)" }}>@{replyingTo}</strong>
            {onCancelReply && (
              <button type="button" onClick={onCancelReply} style={{ marginLeft: 4, fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                ✕ Annuler
              </button>
            )}
          </div>
        )}

        {/* Editor container */}
        <div
          style={{
            border: `1px solid ${editorFocused ? "var(--color-brand)" : "var(--color-border-default)"}`,
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--color-surface-raised)",
            transition: "border-color 150ms ease",
          }}
          onFocusCapture={() => setEditorFocused(true)}
          onBlurCapture={() => setEditorFocused(false)}
        >
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 8px", borderBottom: "1px solid var(--color-border-default)", background: "var(--color-surface-raised)" }}>
            {[
              { Icon: Bold, title: "Gras", cmd: "bold" },
              { Icon: Italic, title: "Italique", cmd: "italic" },
              { Icon: List, title: "Liste", cmd: "insertUnorderedList" },
            ].map(({ Icon, title, cmd }) => (
              <button
                key={cmd}
                type="button"
                title={title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { document.execCommand(cmd, false); editorRef.current?.focus(); syncEmpty(); }}
                style={{ width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", transition: "background 100ms ease" }}
                className="hover:bg-[var(--nc-nav-hover-bg)]"
              >
                <Icon size={13} />
              </button>
            ))}
            <div style={{ width: 1, height: 14, background: "var(--color-border-default)", margin: "0 2px" }} />
            <button
              type="button"
              title="Lien (sélectionne du texte d'abord)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleLinkClick}
              style={{ width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", transition: "background 100ms ease" }}
              className="hover:bg-[rgba(0,0,0,0.06)]"
            >
              <Link size={13} />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                editorRef.current?.focus();
                document.execCommand("insertImage", false, url);
                syncEmpty();
                e.target.value = "";
              }}
            />
            <button
              type="button"
              title="Image"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => imageInputRef.current?.click()}
              style={{ width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", transition: "background 100ms ease" }}
              className="hover:bg-[rgba(0,0,0,0.06)]"
            >
              <ImageIcon size={13} />
            </button>
          </div>

          {/* ContentEditable */}
          <div style={{ position: "relative" }}>
            {editorEmpty && (
              <span style={{ position: "absolute", top: 10, left: 14, color: "var(--color-text-muted)", fontSize: 14, pointerEvents: "none", userSelect: "none" }}>
                {placeholder}
              </span>
            )}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              style={{ minHeight: 60, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", lineHeight: 1.55, color: "var(--color-text-primary)", wordBreak: "break-word" }}
            />
          </div>
        </div>

        {/* Mention suggestions */}
        {suggestions.length > 0 && mentionPos && (
          <div style={{ position: "fixed", top: mentionPos.top, left: mentionPos.left, background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)", borderRadius: 12, boxShadow: "var(--nc-shadow-3)", overflow: "hidden", zIndex: 500, minWidth: 200 }}>
            {suggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(u.name); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: "var(--color-text-primary)" }}
                className="hover:bg-[var(--color-surface-raised)]"
              >
                <UserAvatar user={u} size={24} />
                {u.name}
              </button>
            ))}
          </div>
        )}

        {/* URL input flottant */}
        {urlVisible && (
          <div style={{ position: "fixed", top: urlPos.top, left: urlPos.left, background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)", borderRadius: 12, boxShadow: "var(--nc-shadow-3)", padding: "8px 10px", display: "flex", alignItems: "center", gap: 6, zIndex: 500, animation: "nc-mode-in 150ms var(--nc-ease) both" }}>
            <input
              autoFocus
              type="url"
              placeholder="https://…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } if (e.key === "Escape") setUrlVisible(false); }}
              style={{ border: "1px solid var(--color-border-default)", borderRadius: 8, padding: "6px 10px", fontSize: 13, outline: "none", width: 200, fontFamily: "inherit" }}
            />
            <button type="button" onClick={insertLink} style={{ padding: "6px 12px", background: "var(--color-brand)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>OK</button>
            <button type="button" onClick={() => setUrlVisible(false)} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✕</button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={editorEmpty}
            style={{
              padding: "7px 18px",
              background: !editorEmpty ? "var(--color-brand)" : "var(--nc-btn-disabled-bg)",
              color: !editorEmpty ? "#fff" : "var(--nc-btn-disabled-text)",
              border: "none",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: !editorEmpty ? "pointer" : "not-allowed",
              transition: "all 150ms ease",
            }}
          >
            Commenter
          </button>
        </div>
      </div>
    </div>
  );
}
