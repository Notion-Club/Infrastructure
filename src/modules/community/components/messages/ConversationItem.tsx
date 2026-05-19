import type { Conversation } from "../../types/conversation.types";
import { shortDate } from "../../utils/date-helpers";
import { UserAvatar } from "../shared/UserAvatar";

interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, active, onClick }: ConversationItemProps) {
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const preview = lastMsg
    ? lastMsg.type === "pdf"
      ? "📎 Fichier PDF"
      : lastMsg.type === "image"
      ? "🖼 Image"
      : lastMsg.body.slice(0, 50) + (lastMsg.body.length > 50 ? "…" : "")
    : "Aucun message";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        border: "none",
        background: active ? "rgba(224,98,90,0.08)" : "transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 150ms ease",
      }}
      className={!active ? "hover:bg-[rgba(0,0,0,0.04)]" : ""}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <UserAvatar user={conversation.participant} size={44} />
        {conversation.unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: -2,
              minWidth: 16,
              height: 16,
              background: "var(--color-brand)",
              color: "white",
              borderRadius: 9999,
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid white",
              padding: "0 3px",
            }}
          >
            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: conversation.unreadCount > 0 ? 700 : 500,
              color: "var(--color-text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {conversation.participant.name}
          </span>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>
            {shortDate(conversation.lastMessageAt)}
          </span>
        </div>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 12,
            color: conversation.unreadCount > 0 ? "var(--color-text-secondary)" : "var(--color-text-muted)",
            fontWeight: conversation.unreadCount > 0 ? 500 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {preview}
        </p>
      </div>
    </button>
  );
}
