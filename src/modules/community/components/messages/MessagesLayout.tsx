"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import type { Conversation } from "../../types/conversation.types";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { MessagesEmptyState } from "./MessagesEmptyState";
import {
  createConversationAction,
  getConversationAction,
  markConversationReadAction,
  sendMessageAction,
} from "../../server/actions";

interface MessagesLayoutProps {
  currentUser: User;
  devRole: DevRole;
  initialConversations: Conversation[];
  initialConversationId?: string | null;
  embedded?: boolean;
}

export function MessagesLayout({
  currentUser,
  initialConversations,
  initialConversationId,
  embedded,
}: MessagesLayoutProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [, startTransition] = useTransition();
  const didInit = useRef(false);
  // IDs de conversations dont les messages sont en cours de chargement
  // (getConversationAction en vol). Sert à afficher le skeleton dans le
  // thread sans casser le state Conversation (messages: []).
  const [loadingConvIds, setLoadingConvIds] = useState<Set<string>>(new Set());
  // Cache local : IDs de conversations dont les messages ont déjà été
  // chargés au moins une fois. Évite de re-fetcher quand l'utilisateur
  // revient sur une conv déjà vue dans la même session.
  const loadedConvIds = useRef<Set<string>>(new Set());

  // Préchauffage : déclenché au mouseEnter d'un item de la liste. On lance
  // getConversationAction en background si la conv n'est pas déjà chargée,
  // pour que le clic ouvre instantanément (cache hit dans handleSelect).
  // Best-effort — pas de skeleton, pas de toast d'erreur.
  function handlePrefetch(id: string) {
    if (loadedConvIds.current.has(id) || loadingConvIds.has(id)) return;
    setLoadingConvIds((prev) => new Set(prev).add(id));
    getConversationAction(id)
      .then((conv) => {
        setLoadingConvIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (!conv) return;
        loadedConvIds.current.add(id);
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? conv : c)),
        );
      })
      .catch(() => {
        setLoadingConvIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  }

  // Marquer la conv comme lue côté DB + fetch les messages détaillés.
  // listConversations() ne charge pas messages[] (par perf), on les tire
  // ici via getConversationAction au moment où l'utilisateur ouvre la conv.
  function handleSelect(id: string) {
    setActiveId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
    setMobileView("thread");

    // Skip si déjà chargé dans cette session — render instantané.
    if (loadedConvIds.current.has(id)) {
      // markRead idempotent en background, sans loading state.
      markConversationReadAction({ conversation_id: id }).catch(() => {});
      return;
    }

    setLoadingConvIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const [conv] = await Promise.all([
        getConversationAction(id),
        markConversationReadAction({ conversation_id: id }),
      ]);
      setLoadingConvIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (!conv) return;
      loadedConvIds.current.add(id);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? conv : c)),
      );
    });
  }

  // Le bouton DM dans UserHoverCard navigue avec ?conversation=<userId> —
  // pas un convId. Si l'autre user n'a pas encore de conv avec moi, on en
  // crée une via createConversationAction (RLS two-silo gère l'autorisation).
  function handleNewConversation(targetUserId: string) {
    const existing = conversations.find((c) => c.participant.id === targetUserId);
    if (existing) {
      handleSelect(existing.id);
      return;
    }
    startTransition(async () => {
      const result = await createConversationAction({ target_user_id: targetUserId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const conv = await getConversationAction(result.conversationId);
      if (!conv) {
        // La conv a été créée côté DB mais on n'arrive pas à la re-fetch.
        // Cas peu probable (cache stale ou RLS qui bouge), on prévient l'user
        // pour qu'il rafraîchisse plutôt que de rester sans feedback.
        toast.error("Conversation créée mais impossible à charger. Recharge la page.");
        return;
      }
      setConversations((prev) => {
        // Si la conv existait déjà, on la garde à sa place ; sinon on
        // l'ajoute en tête (last_message_at = now au moment de la création).
        if (prev.some((c) => c.id === conv.id)) {
          return prev.map((c) => (c.id === conv.id ? conv : c));
        }
        return [conv, ...prev];
      });
      setActiveId(result.conversationId);
      setMobileView("thread");
      router.refresh();
    });
  }

  // Envoi d'un message — appelée par MessageComposer via ConversationThread.
  // reply optionnel : alimente reply_to_message_id + snippet + author_name
  // (mig. 027). attachment optionnel : alimente type/file_url/file_name pour
  // les messages avec image/pdf attaché.
  function handleSendMessage(
    conversationId: string,
    body: string,
    reply?: { messageId: string; authorName: string; snippet: string } | null,
    attachment?: { type: "text" | "image" | "pdf"; fileUrl?: string; fileName?: string },
  ) {
    const trimmed = body.trim();
    const isAttachment = attachment && attachment.type !== "text" && attachment.fileUrl;
    // Avant : on bloquait si body vide. Maintenant un message image-only
    // (body trimmed === "") est valide à condition que fileUrl soit fourni.
    if (!trimmed && !isAttachment) return;
    startTransition(async () => {
      const result = await sendMessageAction({
        conversation_id: conversationId,
        type: isAttachment ? attachment.type : "text",
        body: trimmed,
        file_url: attachment?.fileUrl ?? null,
        file_name: attachment?.fileName ?? null,
        reply_to_message_id: reply?.messageId ?? null,
        reply_snippet: reply?.snippet ?? null,
        reply_author_name: reply?.authorName ?? null,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // Re-fetch la conv pour récupérer le vrai message DB et purger
      // l'optimistic local de ConversationThread.
      const conv = await getConversationAction(conversationId);
      if (conv) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? conv : c)),
        );
      }
      router.refresh();
    });
  }

  // Resolve initialConversationId — peut être un convId OU un userId.
  useEffect(() => {
    if (!initialConversationId || didInit.current) return;
    didInit.current = true;
    const byConvId = conversations.find((c) => c.id === initialConversationId);
    if (byConvId) {
      handleSelect(byConvId.id);
      return;
    }
    const byUserId = conversations.find((c) => c.participant.id === initialConversationId);
    if (byUserId) {
      handleSelect(byUserId.id);
      return;
    }
    handleNewConversation(initialConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          height: embedded ? "100%" : "calc(100dvh - 148px)",
          background: "var(--color-surface-card)",
        }}
      >
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          currentUser={currentUser}
          onSelect={handleSelect}
          onPrefetch={handlePrefetch}
          onNewConversation={handleNewConversation}
        />
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeConv ? (
            <ConversationThread
              conversation={activeConv}
              currentUser={currentUser}
              loading={loadingConvIds.has(activeConv.id)}
              onSendMessage={(body, reply, attachment) => handleSendMessage(activeConv.id, body, reply, attachment)}
            />
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
          background: "var(--color-surface-card)",
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
            loading={loadingConvIds.has(activeConv.id)}
            onSendMessage={(body, reply, attachment) => handleSendMessage(activeConv.id, body, reply, attachment)}
            onBack={() => setMobileView("list")}
          />
        ) : (
          <MessagesEmptyState />
        )}
      </div>
    </>
  );
}
