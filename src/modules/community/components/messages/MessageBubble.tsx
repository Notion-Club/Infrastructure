"use client";

import { useState } from "react";
import { FileText, MoreHorizontal } from "lucide-react";
import type { Message } from "../../types/conversation.types";
import { timeAgo } from "../../utils/date-helpers";

const EMOJIS = ["❤️", "🔥", "🎉", "🙌", "💡", "😍", "👏", "🤯"];

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MessageBubble({ message, isSelf, onEdit, onDelete }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState(message.reactions);

  if (message.deleted) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: isSelf ? "flex-end" : "flex-start",
          margin: "4px 0",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
          Message supprimé
        </span>
      </div>
    );
  }

  function handleReaction(emoji: string) {
    setReactions((prev) => {
      const userId = "viewer";
      const has = prev.find((r) => r.userId === userId);
      if (has?.emoji === emoji) return prev.filter((r) => r.userId !== userId);
      if (has) return prev.map((r) => r.userId === userId ? { emoji, userId } : r);
      return [...prev, { emoji, userId }];
    });
    setShowEmojiPicker(false);
  }

  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isSelf ? "flex-end" : "flex-start",
        margin: "2px 0",
        position: "relative",
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isSelf ? "row-reverse" : "row" }}>
        {/* Bubble */}
        <div
          style={{
            maxWidth: 320,
            padding: message.type === "pdf" ? "10px 14px" : "10px 14px",
            borderRadius: isSelf ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: isSelf ? "var(--color-brand)" : "white",
            color: isSelf ? "#fff" : "var(--color-text-primary)",
            border: isSelf ? "none" : "1px solid var(--color-border-default)",
            fontSize: 14,
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {message.type === "text" && <span style={{ whiteSpace: "pre-wrap" }}>{message.body}</span>}
          {message.type === "image" && (
            <div>
              <img src={message.fileUrl} alt="image" style={{ maxWidth: "100%", borderRadius: 8, display: "block" }} />
            </div>
          )}
          {message.type === "pdf" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={20} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{message.fileName ?? message.body}</span>
            </div>
          )}
        </div>

        {/* Hover actions */}
        {showActions && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker((o) => !o)}
                style={{
                  width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--color-border-default)",
                  background: "white", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                😊
              </button>
              {showEmojiPicker && (
                <div style={{
                  position: "absolute", [isSelf ? "right" : "left"]: 0, bottom: "calc(100% + 4px)",
                  background: "white", border: "1px solid var(--color-border-default)", borderRadius: 12,
                  boxShadow: "var(--nc-shadow-3)", padding: 8, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, zIndex: 100,
                }}>
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => handleReaction(e)}
                      style={{ width: 32, height: 32, fontSize: 18, border: "none", background: "transparent", borderRadius: 6, cursor: "pointer" }}
                      className="hover:bg-[rgba(0,0,0,0.06)]"
                    >{e}</button>
                  ))}
                </div>
              )}
            </div>
            {isSelf && (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  style={{
                    width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--color-border-default)",
                    background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--color-text-muted)",
                  }}
                  onClick={() => {
                    const choice = window.confirm("Modifier (OK) ou Supprimer (Annuler) ?");
                    if (choice && onEdit) onEdit();
                    else if (!choice && onDelete) onDelete();
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reactions */}
      {Object.keys(grouped).length > 0 && (
        <div style={{
          display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap",
          justifyContent: isSelf ? "flex-end" : "flex-start",
        }}>
          {Object.entries(grouped).map(([emoji, count]) => (
            <span key={emoji} onClick={() => handleReaction(emoji)}
              style={{
                fontSize: 12, padding: "2px 8px", borderRadius: 9999, background: "white",
                border: "1px solid var(--color-border-default)", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              {emoji} {count}
            </span>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3 }}>
        {timeAgo(message.createdAt)}
      </span>
    </div>
  );
}
