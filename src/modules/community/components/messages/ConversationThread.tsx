"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import type { Conversation, Message } from "../../types/conversation.types";
import type { User } from "../../types/user.types";
import { REPLY_SNIPPET_MAX } from "../../lib/validation";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer, type ReplyContext } from "./MessageComposer";
import { ConversationEmptyState } from "./MessagesEmptyState";
import { UserAvatar } from "../shared/UserAvatar";

interface ConversationThreadProps {
  conversation: Conversation;
  currentUser: User;
  // Le parent peut désormais recevoir un payload riche (body + quote-reply)
  // pour que sendMessageAction puisse écrire reply_to_message_id et al.
  // L'ancien onSendMessage(body: string) reste compatible si reply est null.
  onSendMessage: (body: string, reply?: ReplyContext | null) => void;
  onBack?: () => void;
}

export function ConversationThread({ conversation, currentUser, onSendMessage, onBack }: ConversationThreadProps) {
  // Optimistic local : ajoute le message immédiatement, le parent fera un
  // router.refresh() qui le remplacera par la vraie ligne DB.
  const [optimisticMessages, setOptimisticMessages] = useState<typeof conversation.messages>([]);
  // Quote-reply en cours — alimente le MessageComposer avec le snippet du
  // message cité. Reset à chaque envoi ou changement de conv.
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset des messages optimistic + replyContext quand on change de conv ou
  // que les messages DB sont rechargés via router.refresh().
  useEffect(() => {
    setOptimisticMessages([]);
    setReplyContext(null);
  }, [conversation.id, conversation.messages]);

  const messages = [...conversation.messages, ...optimisticMessages];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const isDeleted = conversation.participant.deleted;
  const disabledMsg = isDeleted
    ? "Cet utilisateur n'est plus membre du Notion Club"
    : undefined;

  function handleReply(target: Message) {
    // Snippet : tronqué côté front à REPLY_SNIPPET_MAX, le serveur retrim.
    // Pour un message non-texte (image/pdf), on affiche le nom de fichier
    // ou un libellé générique pour donner du contexte dans la quote.
    const rawSnippet =
      target.type === "text"
        ? target.body
        : target.fileName ?? (target.type === "image" ? "[Image]" : "[Fichier]");
    const snippet = rawSnippet.slice(0, REPLY_SNIPPET_MAX);
    const authorName =
      target.senderId === currentUser.id
        ? currentUser.name
        : conversation.participant.name;
    setReplyContext({
      messageId: target.id,
      authorName,
      snippet,
    });
  }

  function handleSend(body: string, type: "text" | "pdf" | "image" = "text", fileName?: string) {
    // Capture le replyContext avant reset, pour le passer au parent ET dans
    // le state optimistic (les nouveaux messages doivent afficher la quote
    // immédiatement, sans attendre router.refresh).
    const reply = replyContext;
    setReplyContext(null);

    // Optimistic — sera remplacé au router.refresh() côté parent.
    setOptimisticMessages((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        senderId: currentUser.id,
        type,
        body,
        fileName,
        reactions: [],
        createdAt: new Date().toISOString(),
        replyToMessageId: reply?.messageId ?? null,
        replySnippet: reply?.snippet ?? null,
        replyAuthorName: reply?.authorName ?? null,
      },
    ]);
    onSendMessage(body, reply);
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
              currentUser={currentUser}
              onReply={handleReply}
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
        replyContext={replyContext ?? undefined}
        onCancelReply={() => setReplyContext(null)}
      />
    </div>
  );
}
