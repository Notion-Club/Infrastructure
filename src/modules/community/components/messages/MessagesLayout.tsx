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
  resolveUsernameAction,
  sendMessageAction,
} from "../../server/actions";

interface MessagesLayoutProps {
  currentUser: User;
  devRole: DevRole;
  initialConversations: Conversation[];
  // Username de la conversation à ouvrir, issu de la route
  // /communaute/messages/<username>. null = onglet messages sans conv ouverte.
  conversationUsername?: string | null;
  embedded?: boolean;
}

export function MessagesLayout({
  currentUser,
  initialConversations,
  conversationUsername,
  embedded,
}: MessagesLayoutProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [, startTransition] = useTransition();
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

  // Crée (ou réutilise) la conversation avec un user donné. Appelée par la
  // résolution d'URL quand /messages/<username> cible un user sans conv
  // existante. createConversationAction applique la RLS two-silo.
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
      loadedConvIds.current.add(result.conversationId);
      setMobileView("thread");
      // Aligne l'URL sur la conv fraîchement créée (username du participant).
      const targetUsername = conv.participant.username ?? conv.participant.id;
      if (conversationUsername?.replace(/^@/, "").toLowerCase() !== targetUsername.toLowerCase()) {
        router.replace(`/communaute/messages/${targetUsername}`);
      }
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

  // Username de deep-link d'une conversation (fallback id si pas de username
  // — défensif, username est en pratique toujours présent cf. migration 010).
  function usernameForConv(conv: Conversation): string {
    return conv.participant.username ?? conv.participant.id;
  }

  // Navigation : ouvrir une conversation = pousser l'URL. L'URL est la source
  // de vérité ; l'effet ci-dessous réagit au changement de conversationUsername
  // pour ouvrir/charger la conv. On évite ainsi toute désync state ↔ URL.
  function navigateToConversation(conv: Conversation) {
    router.push(`/communaute/messages/${usernameForConv(conv)}`);
  }

  // Retour à la liste (mobile) = retirer le username de l'URL.
  function navigateToList() {
    setMobileView("list");
    router.push("/communaute/messages");
  }

  // Clic sur un item de la liste : on navigue par l'URL (l'effet ouvre la
  // conv). Render optimiste immédiat de activeId pour le surlignage, sans
  // attendre le re-render de la route.
  function handleSelectByUrl(id: string) {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setActiveId(id);
    navigateToConversation(conv);
  }

  // Résolution réactive de conversationUsername (route /messages/<username>).
  // Réagit à chaque changement d'URL : ouvre la conv existante portant ce
  // username, sinon résout username → userId et crée la conv. Si null
  // (route /messages nue), on ferme le thread.
  useEffect(() => {
    let cancelled = false;

    // Différé via microtask (await Promise.resolve) pour respecter la règle
    // react-hooks/set-state-in-effect du repo : aucun setState synchrone dans
    // le corps de l'effet (cf. useCurrentUser / usePushSubscription).
    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      if (!conversationUsername) {
        setActiveId(null);
        setMobileView("list");
        return;
      }
      const clean = conversationUsername.replace(/^@/, "").toLowerCase();

      // 1. Conversation existante dont le participant a ce username.
      const byUsername = conversations.find(
        (c) => c.participant.username?.toLowerCase() === clean,
      );
      if (byUsername) {
        handleSelect(byUsername.id);
        return;
      }
      // 2. Fallback : le segment d'URL est un id (participant sans username),
      //    ou directement un id de conversation (notifs/emails qui ne
      //    connaissent qu'un convId). On normalise l'URL vers le username dès
      //    qu'on a résolu la conv, pour rester propre.
      const byParticipantId = conversations.find(
        (c) => c.participant.id === conversationUsername,
      );
      const byConvId = conversations.find((c) => c.id === conversationUsername);
      const resolvedConv = byParticipantId ?? byConvId;
      if (resolvedConv) {
        handleSelect(resolvedConv.id);
        const uname = resolvedConv.participant.username;
        if (uname && uname.toLowerCase() !== clean) {
          router.replace(`/communaute/messages/${uname}`);
        }
        return;
      }
      // 3. Aucune conv existante : résoudre username → userId puis créer.
      const resolved = await resolveUsernameAction(conversationUsername);
      if (cancelled) return;
      if (!resolved) {
        // Username inconnu / invisible : retour à la liste des messages.
        toast.error("Utilisateur introuvable.");
        router.replace("/communaute/messages");
        return;
      }
      handleNewConversation(resolved.userId);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationUsername, conversations]);

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
          onSelect={handleSelectByUrl}
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
            onSelect={handleSelectByUrl}
            onNewConversation={handleNewConversation}
          />
        ) : activeConv ? (
          <ConversationThread
            conversation={activeConv}
            currentUser={currentUser}
            loading={loadingConvIds.has(activeConv.id)}
            onSendMessage={(body, reply, attachment) => handleSendMessage(activeConv.id, body, reply, attachment)}
            onBack={navigateToList}
          />
        ) : (
          <MessagesEmptyState />
        )}
      </div>
    </>
  );
}
