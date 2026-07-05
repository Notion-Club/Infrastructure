"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import type { Conversation, Message } from "../../types/conversation.types";
import { useConversationsRealtime } from "../../hooks/useConversationsRealtime";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { MessagesEmptyState } from "./MessagesEmptyState";
import { NewConversationModal } from "./NewConversationModal";
import {
  createConversationAction,
  getConversationAction,
  getNewMessagesAction,
  markConversationReadAction,
  resolveUsernameAction,
  sendMessageAction,
} from "../../server/actions";

// Aperçu du dernier message pour la sidebar — aligné sur le calcul serveur de
// listConversations (texte tronqué à 140, libellé symbolique pour les fichiers).
function previewForMessage(m: Message): string {
  if (m.type === "image") return "📷 Image";
  if (m.type === "pdf") return `📎 ${m.fileName ?? "Fichier"}`;
  return m.body.slice(0, 140);
}

// Tri antichronologique (dernier message en haut), comme listConversations.
function byLastMessageDesc(a: Conversation, b: Conversation): number {
  return a.lastMessageAt < b.lastMessageAt ? 1 : a.lastMessageAt > b.lastMessageAt ? -1 : 0;
}

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
  // Sélecteur de membres ouvert depuis le bouton inline de l'état vide du
  // panneau thread (desktop) / vue thread (mobile). La liste a son propre
  // sélecteur (ConversationList) ; celui-ci sert les états vides de ce composant.
  const [newConvPickerOpen, setNewConvPickerOpen] = useState(false);
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
  // Miroir de activeId, lu par le handler Realtime (handleIncomingMessage) qui
  // doit rester stable : sans ce ref, dépendre de activeId relancerait
  // l'abonnement Realtime à chaque ouverture de conversation.
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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
  // Renvoie le message DB réconcilié (ou null si échec) pour que
  // ConversationThread purge son optimistic `pending-…`. Plus de re-fetch
  // intégral : on insère le message retourné directement dans le state local —
  // latence constante quelle que soit la taille de la conversation.
  async function handleSendMessage(
    conversationId: string,
    body: string,
    reply?: { messageId: string; authorName: string; snippet: string } | null,
    attachment?: { type: "text" | "image" | "pdf"; fileUrl?: string; fileName?: string },
  ): Promise<Message | null> {
    const trimmed = body.trim();
    const isAttachment = attachment && attachment.type !== "text" && attachment.fileUrl;
    // Avant : on bloquait si body vide. Maintenant un message image-only
    // (body trimmed === "") est valide à condition que fileUrl soit fourni.
    if (!trimmed && !isAttachment) return null;

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
      return null;
    }

    const message = result.message;
    setConversations((prev) =>
      prev
        .map((c) => {
          if (c.id !== conversationId) return c;
          // Append dédupliqué (le delta Realtime ou un double envoi ne doivent
          // jamais créer deux bulles pour le même id).
          const messages = c.messages.some((m) => m.id === message.id)
            ? c.messages
            : [...c.messages, message];
          return {
            ...c,
            messages,
            lastMessageAt: message.createdAt,
            lastMessagePreview: previewForMessage(message),
            lastMessageType: message.type,
            lastMessageFromMe: true,
          };
        })
        .sort(byLastMessageDesc),
    );
    return message;
  }

  // Réception d'un message en TEMPS RÉEL (mig. 039 + useConversationsRealtime).
  // Déclenché uniquement pour les messages d'AUTRES participants (le hook
  // ignore les miens, déjà gérés par l'optimistic du flux d'envoi). On re-fetch
  // la conv concernée et on merge dans le state.
  //
  // ANTI-FREEZE : callback stable (useCallback []), lit activeId via activeIdRef,
  // n'utilise QUE setConversations(prev => …). Ne touche jamais l'effet de
  // résolution d'URL (qui ne dépend que de conversationUsername) → aucune boucle.
  const handleIncomingMessage = useCallback((conversationId: string) => {
    void (async () => {
      const isActive = activeIdRef.current === conversationId;
      const current = conversationsRef.current.find((c) => c.id === conversationId);

      // Conv inconnue ou jamais chargée → full-load (cas rare : 1ʳᵉ réception,
      // ou conv absente du state). Bon marché car premier accès.
      if (!current || !loadedConvIds.current.has(conversationId)) {
        const conv = await getConversationAction(conversationId);
        if (!conv) return;
        loadedConvIds.current.add(conversationId);
        if (isActive) {
          markConversationReadAction({ conversation_id: conversationId }).catch(() => {});
        }
        setConversations((prev) => {
          const merged = isActive ? { ...conv, unreadCount: 0 } : conv;
          const next = prev.some((c) => c.id === conversationId)
            ? prev.map((c) => (c.id === conversationId ? merged : c))
            : [merged, ...prev];
          return next.sort(byLastMessageDesc);
        });
        return;
      }

      // Cas normal : delta borné. On ne tire que les messages plus récents que
      // le dernier connu, et on les append dédupliqués — plus de re-fetch de
      // toute la conversation à chaque message entrant.
      const lastKnown = current.messages.length
        ? current.messages[current.messages.length - 1]!.createdAt
        : current.lastMessageAt;
      const fresh = await getNewMessagesAction(conversationId, lastKnown);
      if (fresh.length === 0) return;
      if (isActive) {
        markConversationReadAction({ conversation_id: conversationId }).catch(() => {});
      }
      setConversations((prev) =>
        prev
          .map((c) => {
            if (c.id !== conversationId) return c;
            const seen = new Set(c.messages.map((m) => m.id));
            const appended = [...c.messages];
            let unreadDelta = 0;
            for (const m of fresh) {
              if (seen.has(m.id)) continue;
              appended.push(m);
              if (m.senderId !== currentUser.id) unreadDelta += 1;
            }
            const last = appended[appended.length - 1]!;
            return {
              ...c,
              messages: appended,
              lastMessageAt: last.createdAt,
              lastMessagePreview: previewForMessage(last),
              lastMessageType: last.type,
              lastMessageFromMe: last.senderId === currentUser.id,
              unreadCount: isActive ? 0 : c.unreadCount + unreadDelta,
            };
          })
          .sort(byLastMessageDesc),
      );
    })();
  }, [currentUser.id]);

  // Découverte d'une nouvelle conversation reçue en Realtime (canal dm-user,
  // mig. 047) : un premier message d'un inconnu crée une conversation à laquelle
  // on n'est pas encore abonné. On la charge et on l'insère dans le state —
  // l'abonnement à son canal `conv:<id>` suit automatiquement (idsKey change).
  const handleNewConversation = useCallback((conversationId: string) => {
    void (async () => {
      if (conversationsRef.current.some((c) => c.id === conversationId)) return;
      const conv = await getConversationAction(conversationId);
      if (!conv) return;
      loadedConvIds.current.add(conversationId);
      setConversations((prev) => {
        if (prev.some((c) => c.id === conversationId)) {
          return prev.map((c) => (c.id === conversationId ? conv : c));
        }
        return [conv, ...prev].sort(byLastMessageDesc);
      });
    })();
  }, []);

  // Ensemble stable des ids de conversations abonnées (ne change qu'à l'ajout/
  // retrait d'une conversation, pas à chaque message).
  const conversationIds = useMemo(() => conversations.map((c) => c.id), [conversations]);

  // Abonnement Realtime Broadcast : un canal privé par conversation + le canal
  // dm-user pour les nouvelles conversations (mig. 047).
  useConversationsRealtime(
    currentUser.id,
    conversationIds,
    handleIncomingMessage,
    handleNewConversation,
  );

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
          // Embedded : on REMPLIT le parent flex (`.nc-messages-embed`, flex-col)
          // via flex plutôt que `height:100%` — le pourcentage ne se résolvait
          // pas dans la chaîne flex (halo en min-height) et la grille retombait à
          // sa hauteur de contenu, laissant apparaître le fond gris de l'encadré
          // en dessous. flex:1 + min-height:0 comble toute la carte.
          ...(embedded
            ? { flex: "1 1 auto", minHeight: 0 }
            : { height: "calc(100dvh - 148px)" }),
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
              key={activeConv.id}
              conversation={activeConv}
              currentUser={currentUser}
              loading={loadingConvIds.has(activeConv.id)}
              onSendMessage={(body, reply, attachment) => handleSendMessage(activeConv.id, body, reply, attachment)}
            />
          ) : (
            <MessagesEmptyState onNewConversation={() => setNewConvPickerOpen(true)} />
          )}
        </div>
      </div>

      {/* Mobile: liste OU thread.
          Hauteur = 100% en embedded → on REMPLIT exactement `.nc-messages-embed`
          (seule source de vérité de la hauteur, qui tient compte de la safe-area
          PWA). Avant, ce div forçait son propre `calc(100dvh - 200px)` — 24px de
          plus que l'embed (`100dvh - 224px`) → le bas du thread (derniers messages
          + composer) débordait sous la BottomNav, d'où « pas tout en bas » à
          l'ouverture. Le `calc` ne sert plus que le cas non-embedded (théorique). */}
      <div
        className="md:hidden"
        style={{
          ...containerStyle,
          background: "var(--color-surface-card)",
          height: embedded ? "100%" : "calc(100dvh - 200px)",
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
            key={activeConv.id}
            conversation={activeConv}
            currentUser={currentUser}
            loading={loadingConvIds.has(activeConv.id)}
            onSendMessage={(body, reply, attachment) => handleSendMessage(activeConv.id, body, reply, attachment)}
            onBack={navigateToList}
          />
        ) : (
          <MessagesEmptyState onNewConversation={() => setNewConvPickerOpen(true)} />
        )}
      </div>

      {newConvPickerOpen && (
        <NewConversationModal
          currentUser={currentUser}
          onClose={() => setNewConvPickerOpen(false)}
          onSelect={(userId) => {
            handleNewConversationByUser(userId);
            setNewConvPickerOpen(false);
          }}
        />
      )}
    </>
  );
}
