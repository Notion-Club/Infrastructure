"use client";

import { useState, useEffect } from "react";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { MOCK_CONVERSATIONS } from "../../mocks/conversations.mock";
import { MOCK_USERS } from "../../mocks/users.mock";
import type { Conversation } from "../../types/conversation.types";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { MessagesEmptyState } from "./MessagesEmptyState";

interface MessagesLayoutProps {
  currentUser: User;
  devRole: DevRole;
  initialConversationId?: string | null;
}

export function MessagesLayout({ currentUser, initialConversationId }: MessagesLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId ?? null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  useEffect(() => {
    if (initialConversationId) {
      setActiveId(initialConversationId);
      setMobileView("thread");
    }
  }, [initialConversationId]);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  function handleSelect(id: string) {
    setActiveId(id);
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, unreadCount: 0 } : c)
    );
    setMobileView("thread");
  }

  function handleNewConversation(userId: string) {
    const existingConv = conversations.find((c) => c.participant.id === userId);
    if (existingConv) {
      handleSelect(existingConv.id);
      return;
    }
    const user = MOCK_USERS.find((u) => u.id === userId);
    if (!user) return;
    const newConv: Conversation = {
      id: `conv-new-${userId}`,
      participant: user,
      messages: [],
      unreadCount: 0,
      lastMessageAt: new Date().toISOString(),
    };
    setConversations((prev) => [newConv, ...prev]);
    handleSelect(newConv.id);
  }

  return (
    <>
      {/* Desktop: 2 colonnes */}
      <div
        className="hidden md:grid"
        style={{
          gridTemplateColumns: "280px 1fr",
          height: "calc(100dvh - 148px)",
          background: "white",
          border: "1px solid var(--color-border-default)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "var(--nc-shadow-3)",
        }}
      >
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          currentUser={currentUser}
          onSelect={handleSelect}
          onNewConversation={handleNewConversation}
        />
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeConv ? (
            <ConversationThread conversation={activeConv} currentUser={currentUser} />
          ) : (
            <MessagesEmptyState />
          )}
        </div>
      </div>

      {/* Mobile: liste OU thread */}
      <div
        className="md:hidden"
        style={{
          background: "white",
          border: "1px solid var(--color-border-default)",
          borderRadius: 16,
          overflow: "hidden",
          height: "calc(100dvh - 200px)",
          boxShadow: "var(--nc-shadow-3)",
        }}
      >
        {mobileView === "list" ? (
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            currentUser={currentUser}
            onSelect={handleSelect}
            onNewConversation={handleNewConversation}
          />
        ) : activeConv ? (
          <ConversationThread
            conversation={activeConv}
            currentUser={currentUser}
            onBack={() => setMobileView("list")}
          />
        ) : (
          <MessagesEmptyState />
        )}
      </div>
    </>
  );
}
