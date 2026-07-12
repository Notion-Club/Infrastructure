"use client";

import { useState, type ReactNode } from "react";
import type { Conversation } from "../../types/conversation.types";
import { shortDate } from "../../utils/date-helpers";
import { UserAvatar } from "../shared/UserAvatar";
import { Photo } from "@/shared/components/icons";

interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  // Préchauffage : appelé au mouseEnter (desktop) ou touchStart (mobile)
  // pour lancer le fetch des messages avant que l'user ne clique. Évite
  // le délai d'attente sur l'ouverture de la conv.
  onPrefetch?: () => void;
}

export function ConversationItem({ conversation, active, onClick, onPrefetch }: ConversationItemProps) {
  // Hover piloté en JS : le fond `transparent` inline l'emportait sur la classe
  // `hover:bg-*` (style inline > feuille de style) → aucun survol visible.
  // Même correctif que le menu ⋅⋅⋅ des posts.
  const [hovered, setHovered] = useState(false);
  // Source primaire : lastMessagePreview hydraté par listConversations
  // (mig. queries — preview tronqué côté serveur, libellé symbolique pour
  // image/pdf). Fallback : on regarde conversation.messages au cas où on a
  // déjà chargé le détail via getConversation (cache local).
  // Cas image (fallback messages) : on rend l'icône Photo + "Image" en JSX
  // au lieu de l'emoji 📷. Détecté séparément pour ne pas casser le
  // traitement string (slice/length) des autres cas.
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const isImageFallback =
    !conversation.lastMessagePreview && lastMsg?.type === "image";

  const rawPreview = conversation.lastMessagePreview
    ?? (() => {
      if (!lastMsg) return undefined;
      if (lastMsg.type === "pdf") return "📎 Fichier";
      if (lastMsg.type === "image") return "📷 Image";
      return lastMsg.body;
    })();

  // Préfixe "Vous : …" pour les messages envoyés par le viewer — convention
  // WhatsApp/Slack qui aide à scanner la liste.
  const previewText = rawPreview ? rawPreview.slice(0, 50) : "Aucun message";
  const truncated = rawPreview && rawPreview.length > 50 ? "…" : "";
  const preview: ReactNode = isImageFallback ? (
    <span className="inline-flex items-center gap-1">
      {conversation.lastMessageFromMe ? "Vous : " : ""}
      <Photo size={13} /> Image
    </span>
  ) : rawPreview
    ? `${conversation.lastMessageFromMe ? "Vous : " : ""}${previewText}${truncated}`
    : "Aucun message";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => { setHovered(true); onPrefetch?.(); }}
      onMouseLeave={() => setHovered(false)}
      onFocus={onPrefetch}
      data-fb-label={`Carte conversation « ${conversation.participant.name} » · Liste conversations`}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        border: "none",
        background: active
          ? "rgba(224,98,90,0.08)"
          : hovered
            ? "var(--nc-nav-hover-bg)"
            : "transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 150ms ease",
      }}
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
