"use client";

import { useState, useRef } from "react";
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
}

export function CommentComposer({
  currentUser,
  devRole,
  placeholder = "Ajouter un commentaire…",
  replyingTo,
  onCancelReply,
  onSubmit,
}: CommentComposerProps) {
  const [value, setValue] = useState(replyingTo ? `@${replyingTo} ` : "");
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionables = MOCK_USERS.filter(
    (u) => !u.deleted && u.id !== currentUser.id && canMentionUser(currentUser, u)
  );

  const suggestions = mentionSearch !== null
    ? mentionables.filter((u) =>
        u.name.toLowerCase().includes(mentionSearch.toLowerCase())
      ).slice(0, 5)
    : [];

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    const match = v.match(/@(\w*)$/);
    setMentionSearch(match ? match[1] : null);
  }

  function insertMention(name: string) {
    const newVal = value.replace(/@\w*$/, `@${name} `);
    setValue(newVal);
    setMentionSearch(null);
    textareaRef.current?.focus();
  }

  function handleSubmit() {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
    setMentionSearch(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, position: "relative" }}>
      <UserAvatar user={currentUser} size={36} />
      <div style={{ flex: 1, position: "relative" }}>
        {replyingTo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}
          >
            Réponse à <strong style={{ color: "var(--color-brand)" }}>@{replyingTo}</strong>
            {onCancelReply && (
              <button type="button" onClick={onCancelReply} style={{ marginLeft: 4, fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                ✕ Annuler
              </button>
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          style={{
            width: "100%",
            padding: "10px 14px",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            fontSize: 14,
            resize: "none",
            outline: "none",
            background: "white",
            color: "var(--color-text-primary)",
            fontFamily: "inherit",
            transition: "border-color 150ms ease",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--color-border-default)")}
        />

        {suggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "white",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              boxShadow: "var(--nc-shadow-3)",
              overflow: "hidden",
              zIndex: 50,
            }}
          >
            {suggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(u.name); }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 100ms ease",
                  fontSize: 13,
                  color: "var(--color-text-primary)",
                }}
                className="hover:bg-[#f5f5f5]"
              >
                <UserAvatar user={u} size={24} />
                {u.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim()}
            style={{
              padding: "7px 18px",
              background: value.trim() ? "var(--color-brand)" : "#e5e7eb",
              color: value.trim() ? "#fff" : "#9ca3af",
              border: "none",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: value.trim() ? "pointer" : "not-allowed",
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
