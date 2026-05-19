"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import type { Conversation } from "../../types/conversation.types";
import type { User } from "../../types/user.types";
import { ConversationItem } from "./ConversationItem";
import { NewConversationModal } from "./NewConversationModal";
import { MessagesEmptyState } from "./MessagesEmptyState";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  currentUser: User;
  onSelect: (id: string) => void;
  onNewConversation: (userId: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  currentUser,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = query
    ? conversations.filter((c) =>
        c.participant.name.toLowerCase().includes(query.toLowerCase())
      )
    : conversations;

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRight: "1px solid var(--color-border-default)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 12px 10px",
          borderBottom: "1px solid var(--color-border-default)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
            Messages
          </span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "var(--color-brand)", color: "#fff",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "opacity 150ms ease",
            }}
            className="hover:opacity-85"
            aria-label="Nouvelle conversation"
          >
            <Plus size={16} />
          </button>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "var(--color-surface-raised)", borderRadius: 9999,
          padding: "7px 12px", border: "1px solid var(--color-border-default)",
        }}>
          <Search size={13} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Rechercher…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, outline: "none", color: "var(--color-text-primary)" }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 4px" }}>
        {sorted.length === 0 ? (
          <MessagesEmptyState />
        ) : (
          sorted.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              active={conv.id === activeId}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>

      {showModal && (
        <NewConversationModal
          currentUser={currentUser}
          onClose={() => setShowModal(false)}
          onSelect={(userId) => {
            onNewConversation(userId);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
