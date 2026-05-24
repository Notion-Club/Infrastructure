"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import type { Conversation } from "../../types/conversation.types";
import type { User } from "../../types/user.types";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { ConversationEmptyState } from "./MessagesEmptyState";
import { UserAvatar } from "../shared/UserAvatar";

interface ConversationThreadProps {
  conversation: Conversation;
  currentUser: User;
  onBack?: () => void;
}

export function ConversationThread({ conversation, currentUser, onBack }: ConversationThreadProps) {
  const [messages, setMessages] = useState(conversation.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(conversation.messages);
  }, [conversation.id, conversation.messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const isDeleted = conversation.participant.deleted;
  const disabledMsg = isDeleted
    ? "Cet utilisateur n'est plus membre du Notion Club"
    : undefined;

  function handleSend(body: string, type: "text" | "pdf" | "image" = "text", fileName?: string) {
    const newMsg = {
      id: `msg-${Date.now()}`,
      senderId: currentUser.id,
      type,
      body,
      fileName,
      reactions: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Thread header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px",
          borderBottom: "1px solid var(--color-border-default)",
          background: "var(--color-surface-card)",
          flexShrink: 0,
        }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "none", background: "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-text-secondary)", flexShrink: 0,
            }}
            className="hover:bg-[rgba(0,0,0,0.06)]"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <UserAvatar user={conversation.participant} size={36} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: isDeleted ? "var(--color-text-muted)" : "var(--color-text-primary)" }}>
            {conversation.participant.name}
          </div>
          {conversation.participant.role === "admin" || conversation.participant.role === "mentor"
            ? <div style={{ fontSize: 12, color: "var(--color-brand)" }}>
                {conversation.participant.role === "admin" ? "Admin" : "Mentor"}
              </div>
            : null
          }
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {messages.length === 0 ? (
          <ConversationEmptyState />
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSelf={msg.senderId === currentUser.id}
              onEdit={() => alert("Modifier (mock)")}
              onDelete={() => alert("Supprimer (mock)")}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <MessageComposer
        onSend={handleSend}
        disabled={isDeleted}
        disabledMessage={disabledMsg}
      />
    </div>
  );
}
