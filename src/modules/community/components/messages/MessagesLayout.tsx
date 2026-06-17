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
  // URL (segment) déjà résolue — anti-boucle (cf. effet de résolution).
  const resolvedUrlRef = useRef<string | null>(null);
  // Miroir des conversations courantes, lu par l'effet de résolution sans en
  // dépendre (sinon chaque setConversations relancerait l'effet → boucle).
  // Synchronisé dans un effet (jamais pendant le render — règle react-hooks/refs).
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

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

  // Ouvre une conversation : marque lue + charge les messages détaillés.
  // listConversations() ne charge pas messages[] (par perf), on les tire
  // ici via getConversationAction au moment où l'utilisateur ouvre la conv.
  // Idempotent (cache loadedConvIds) → safe à rappeler.
  function openConversation(id: string) {
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
  // IMPORTANT : pas de router.refresh() ici — il re-rendrait le Server
  // Component, réinjecterait initialConversations et relancerait la cascade.
  // Le state local est déjà à jour, ça suffit.
  function createOrOpenConversation(targetUserId: string) {
    startTransition(async () => {
      const result = await createConversationAction({ target_user_id: targetUserId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const conv = await getConversationAction(result.conversationId);
      if (!conv) {
        toast.error("Conversation créée mais impossible à charger. Recharge la page.");
        return;
      }
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) {
          return prev.map((c) => (c.id === conv.id ? conv : c));
        }
        return [conv, ...prev];
      });
      setActiveId(result.conversationId);
      loadedConvIds.current.add(result.conversationId);
      setMobileView("thread");
      // Aligne l'URL sur la conv (username du participant). On marque cette URL
      // comme déjà résolue pour que le replace ne relance pas la résolution.
      const targetUsername = conv.participant.username ?? conv.participant.id;
      const cleanCurrent = conversationUsername?.replace(/^@/, "").toLowerCase();
      if (cleanCurrent !== targetUsername.toLowerCase()) {
        resolvedUrlRef.current = targetUsername;
        router.replace(`/communaute/messages/${targetUsername}`);
      }
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
      // l'optimistic local de ConversationThread. Pas de router.refresh() :
      // le state local est déjà à jour, et un refresh re-rendrait le Server
      // Component inutilement (latence + risque de re-montage du thread).
      const conv = await getConversationAction(conversationId);
      if (conv) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? conv : c)),
        );
      }
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

  // Démarrer une conversation avec un user (picker NewConversationModal). On
  // navigue par l'URL : si une conv avec ce user existe déjà, on cible son
  // username ; sinon on navigue par userId et l'effet de résolution la crée.
  function handleNewConversationByUser(targetUserId: string) {
    const existing = conversations.find((c) => c.participant.id === targetUserId);
    const segment = existing
      ? existing.participant.username ?? existing.participant.id
      : targetUserId;
    router.push(`/communaute/messages/${segment}`);
  }

  // Résolution de l'URL /messages/<segment> → conversation ouverte.
  // Le segment peut être un username, un userId ou un convId (notifs/emails).
  // Exécutée UNE fois par valeur d'URL — l'effet ne dépend QUE de
  // conversationUsername (jamais de `conversations`, sinon boucle infinie →
  // freeze de la page / crash de la PWA). resolvedUrlRef garde la dernière
  // URL traitée pour ignorer les re-renders sans changement d'URL.
  useEffect(() => {
    const segment = conversationUsername ?? null;
    // Déjà traité cette valeur d'URL → on ne refait rien (anti-boucle).
    if (resolvedUrlRef.current === segment) return;
    resolvedUrlRef.current = segment;

    let cancelled = false;
    // Différé via microtask (await Promise.resolve) : aucun setState synchrone
    // dans le corps de l'effet (règle react-hooks/set-state-in-effect du repo,
    // cf. useCurrentUser / usePushSubscription).
    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      if (!segment) {
        // Route /messages nue : on ferme le thread (retour à la liste).
        setActiveId(null);
        setMobileView("list");
        return;
      }

      const clean = segment.replace(/^@/, "").toLowerCase();
      // Lecture via le ref miroir — pas de dépendance sur `conversations`.
      const current = conversationsRef.current;
      const match =
        current.find((c) => c.participant.username?.toLowerCase() === clean) ??
        current.find((c) => c.participant.id === segment) ??
        current.find((c) => c.id === segment);

      if (match) {
        openConversation(match.id);
        // Normalise l'URL vers le username si on était entré par id/convId.
        const uname = match.participant.username;
        if (uname && uname.toLowerCase() !== clean) {
          resolvedUrlRef.current = uname; // évite de re-résoudre après replace
          router.replace(`/communaute/messages/${uname}`);
        }
        return;
      }

      // Aucune conv existante : résoudre le username → userId puis créer.
      const resolved = await resolveUsernameAction(segment);
      if (cancelled) return;
      if (!resolved) {
        toast.error("Utilisateur introuvable.");
        router.replace("/communaute/messages");
        return;
      }
      createOrOpenConversation(resolved.userId);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationUsername]);

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
          onNewConversation={handleNewConversationByUser}
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
            onNewConversation={handleNewConversationByUser}
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
