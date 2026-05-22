"use client";

import { useState, useEffect, useRef } from "react";
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
  embedded?: boolean;
}

export function MessagesLayout({ currentUser, initialConversationId, embedded }: MessagesLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const didInit = useRef(false);

  function handleSelect(id: string) {
    setActiveId(id);
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, unreadCount: 0 } : c)
    );
    setMobileView("thread");
  }

  function handleNewConversation(userId: string) {
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === userId || c.participant.id === userId);
      if (existing) {
        setActiveId(existing.id);
        setMobileView("thread");
        return prev;
      }
      const user = MOCK_USERS.find((u) => u.id === userId);
      if (!user) return prev;
      const newConv: Conversation = {
        id: `conv-new-${userId}`,
        participant: user,
        messages: [],
        unreadCount: 0,
        lastMessageAt: new Date().toISOString(),
      };
      setActiveId(newConv.id);
      setMobileView("thread");
      return [newConv, ...prev];
    });
  }

  // Resolve initialConversationId (may be a userId or convId)
  useEffect(() => {
    if (!initialConversationId || didInit.current) return;
    didInit.current = true;
    const byConvId = MOCK_CONVERSATIONS.find((c) => c.id === initialConversationId);
    if (byConvId) { setActiveId(byConvId.id); setMobileView("thread"); return; }
    const byUserId = MOCK_CONVERSATIONS.find((c) => c.participant.id === initialConversationId);
    if (byUserId) { setActiveId(byUserId.id); setMobileView("thread"); return; }
    handleNewConversation(initialConversationId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  const containerStyle = embedded
    ? { overflow: "hidden" as const }
    : {
        border: "1px solid var(--color-border-default)",
        borderRadius: 16,
        overflow: "hidden" as const,
        boxShadow: "var(--nc-shadow-3)",
      };

  return (
    <>
      {/* Desktop: 2 colonnes */}
      <div
        className="hidden md:grid"
        style={{
          ...containerStyle,
          gridTemplateColumns: "280px 1fr",
          height: "calc(100dvh - 148px)",
          background: "white",
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
          ...containerStyle,
          background: "white",
          height: "calc(100dvh - 200px)",
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
