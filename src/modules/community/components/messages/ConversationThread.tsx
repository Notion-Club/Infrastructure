"use client";

import { useCallback, useState, useEffect, useLayoutEffect, useMemo, useRef, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { ArrowReturn } from "@/shared/components/icons";
import { SkeletonReveal } from "@/shared/components/SkeletonReveal";
import type { Conversation, Message } from "../../types/conversation.types";
import type { User } from "../../types/user.types";
import { REPLY_SNIPPET_MAX } from "../../lib/validation";
import { loadOlderMessagesAction } from "../../server/actions";
import { useTypingPresence } from "../../hooks/useTypingPresence";
import { MessageBubble } from "./MessageBubble";
import { MessageBubbleSkeleton } from "./MessageBubbleSkeleton";
import { MessageComposer, type ReplyContext } from "./MessageComposer";
import { MessageSearchBar } from "./MessageSearchBar";
import { TypingIndicator } from "./TypingIndicator";
import { ConversationEmptyState } from "./MessagesEmptyState";
import { UserAvatar } from "../shared/UserAvatar";

interface ConversationThreadProps {
  conversation: Conversation;
  currentUser: User;
  // true pendant que MessagesLayout fetch les messages via
  // getConversationAction. Le thread affiche alors un skeleton (bulles
  // grises animées) au lieu de l'écran vide ConversationEmptyState.
  loading?: boolean;
  // Le parent peut désormais recevoir un payload riche (body + quote-reply)
  // pour que sendMessageAction puisse écrire reply_to_message_id et al.
  // Signature : (body, reply, attachment?). Le 3e arg est optionnel — il
  // décrit un fichier déjà uploadé sur Supabase Storage par le composer.
  // Quand fourni, sendMessageAction écrira type/file_url/file_name côté DB.
  onSendMessage: (
    body: string,
    reply?: ReplyContext | null,
    attachment?: {
      type: "text" | "image" | "pdf";
      fileUrl?: string;
      fileName?: string;
    },
  ) => Promise<Message | null>;
  onBack?: () => void;
}

export function ConversationThread({ conversation, currentUser, loading, onSendMessage, onBack }: ConversationThreadProps) {
  // Optimistic local : ajoute le message immédiatement, le parent fera un
  // router.refresh() qui le remplacera par la vraie ligne DB.
  const [optimisticMessages, setOptimisticMessages] = useState<typeof conversation.messages>([]);
  // Quote-reply en cours — alimente le MessageComposer avec le snippet du
  // message cité. Reset à chaque envoi ou changement de conv.
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  // Pagination cursor-based — messages plus anciens chargés via le bouton
  // "Charger plus" en haut du thread. Le state local est mergé avec
  // conversation.messages (issu du serveur) avant rendu.
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(conversation.hasMore ?? false);
  const [isLoadingOlder, startLoadOlder] = useTransition();
  // Recherche dans la conv — ouverte/fermée via le bouton loupe du header.
  // Quand un résultat est cliqué, on highlight le message ciblé pendant
  // HIGHLIGHT_MS pour aider l'utilisateur à le repérer après le scroll.
  const HIGHLIGHT_MS = 1800;
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // ID du message dont la toolbar est verrouillée (kebab menu ou picker emoji
  // déployé). Partagé entre TOUTES les bulles pour qu'une seule toolbar à la
  // fois soit interactive — sinon les hovers se chevauchent et l'user clique
  // dans le vide. cf. fix/dm-toolbar-lock-on-open.
  const [lockedMessageId, setLockedMessageId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Container du thread — utilisé pour préserver la position de scroll lors
  // du chargement des messages précédents (sinon le scroll saute en haut).
  const scrollRef = useRef<HTMLDivElement>(null);
  // Ancre de scroll pour le prepend pagination : géométrie capturée AVANT
  // l'insertion des anciens messages, ré-appliquée en useLayoutEffect (+ courte
  // boucle rAF) pour que le 1er message visible reste en place même quand des
  // images chargent en différé. Remplace l'ancien rAF unique (cause du saut).
  const prependAnchorRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  // Typing presence — channel Realtime broadcast par conv. emitTyping est
  // appelé par le composer à chaque frappe (throttled à 2s en interne).
  const { otherIsTyping, emitTyping } = useTypingPresence(
    conversation.id,
    currentUser.id,
  );

  // Pas de reset effect : ConversationThread est monté avec key={conv.id} par
  // MessagesLayout → changer de conversation REMONTE le composant, ce qui
  // réinitialise naturellement tout l'état local (optimistic, olderMessages,
  // recherche, reply, highlight). Avantages : pas de setState-in-effect (règle
  // du repo), et un re-fetch de la conv courante (envoi, realtime) ne vide PLUS
  // l'historique paginé ni la recherche (le composant n'est pas remonté tant
  // que conv.id ne change pas). Les messages serveur à jour sont pris via le
  // merge dédupliqué ci-dessous.

  // Merge older (pagination) + serveur + optimistic, DÉDUPLIQUÉ PAR ID. La
  // dédup est essentielle : un re-fetch serveur ou un event realtime peut
  // ramener un message déjà présent en optimistic → sans dédup, double bulle.
  const messages = useMemo<Message[]>(() => {
    const seen = new Set<string>();
    const out: Message[] = [];
    for (const m of [...olderMessages, ...conversation.messages, ...optimisticMessages]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [olderMessages, conversation.messages, optimisticMessages]);

  // Saut INSTANTANÉ tout en bas à l'OUVERTURE d'une conversation (changement
  // d'id). useLayoutEffect + double rAF : on attend que les bulles soient
  // peintes avant de mesurer scrollHeight (sinon on s'ancre trop haut). Pas de
  // 'smooth' ici : il est interruptible par les reflows (images, re-renders)
  // → c'est exactement ce qui ancrait au milieu de la conversation.
  const openJumpRafRef = useRef<number | null>(null);
  const didOpenJumpRef = useRef(false);
  useLayoutEffect(() => {
    // On attend que de VRAIS messages soient montés avant de sauter en bas. Sur
    // une conversation pas encore en cache, l'ouverture affiche d'abord le
    // skeleton (messages vides) ; sauter à cet instant ancrait sur le skeleton
    // court, et l'utilisateur restait AU MILIEU une fois les messages arrivés.
    // Le composant est remonté par key={conv.id} → didOpenJumpRef repart à false
    // à chaque changement de conversation.
    if (messages.length === 0 || didOpenJumpRef.current) return;
    didOpenJumpRef.current = true;

    let cancelled = false;
    const start = performance.now();
    const pin = () => {
      if (cancelled) return;
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      // Re-épingle brièvement (≤ 500 ms) pour absorber les reflows tardifs
      // (images/embeds qui finissent de peindre) sans lutter durablement
      // contre un scroll utilisateur.
      if (performance.now() - start < 500) {
        openJumpRafRef.current = requestAnimationFrame(pin);
      }
    };
    // 2 rAF : laisser les bulles se peindre avant la 1ʳᵉ mesure de scrollHeight.
    const id1 = requestAnimationFrame(() => {
      openJumpRafRef.current = requestAnimationFrame(pin);
    });
    openJumpRafRef.current = id1;
    return () => {
      cancelled = true;
      if (openJumpRafRef.current) cancelAnimationFrame(openJumpRafRef.current);
    };
  }, [messages.length]);

  // Auto-scroll SMOOTH pour un NOUVEAU message en bas (ou l'apparition du
  // typing indicator), UNIQUEMENT si l'utilisateur est déjà proche du bas —
  // sinon on n'arrache pas quelqu'un qui lit l'historique vers le bas.
  // Le composant étant remonté par key={conv.id}, prevNewestRef démarre à la
  // valeur du 1er render : pas de smooth parasite par-dessus le jump instantané
  // d'ouverture (increased=false au mount).
  const newestCount = conversation.messages.length + optimisticMessages.length;
  const prevNewestRef = useRef(newestCount);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const increased = newestCount > prevNewestRef.current;
      const nearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if ((increased || otherIsTyping) && nearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevNewestRef.current = newestCount;
  }, [newestCount, otherIsTyping]);

  async function handleLoadOlder() {
    if (!messages.length || isLoadingOlder || !hasMore) return;
    const cursorId = messages[0]!.id;
    // Capture la géométrie AVANT le prepend. Le ré-ancrage réel se fait dans le
    // useLayoutEffect ci-dessous (déclenché par la mise à jour d'olderMessages),
    // pour absorber l'arrivée différée des images.
    const container = scrollRef.current;
    prependAnchorRef.current = {
      prevHeight: container?.scrollHeight ?? 0,
      prevTop: container?.scrollTop ?? 0,
    };

    startLoadOlder(async () => {
      const result = await loadOlderMessagesAction(conversation.id, cursorId);
      if (!result.ok) {
        prependAnchorRef.current = null;
        return;
      }
      setOlderMessages((prev) => [...result.messages, ...prev]);
      setHasMore(result.hasMore);
    });
  }

  // Ré-ancrage du scroll après un prepend de messages plus anciens. Une courte
  // boucle rAF maintient le 1er message précédemment visible à sa place tant que
  // la hauteur du flux évolue encore (images qui finissent de peindre), bornée à
  // 1 s pour ne jamais lutter durablement contre un scroll utilisateur.
  useLayoutEffect(() => {
    const anchor = prependAnchorRef.current;
    const c = scrollRef.current;
    if (!anchor || !c) return;
    prependAnchorRef.current = null;

    let cancelled = false;
    const start = performance.now();
    let lastHeight = c.scrollHeight;
    let stableFrames = 0;

    const reanchor = () => {
      if (cancelled || !scrollRef.current) return;
      const el = scrollRef.current;
      el.scrollTop = anchor.prevTop + (el.scrollHeight - anchor.prevHeight);
      if (el.scrollHeight === lastHeight) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
        lastHeight = el.scrollHeight;
      }
      if (stableFrames < 3 && performance.now() - start < 1000) {
        requestAnimationFrame(reanchor);
      }
    };
    requestAnimationFrame(reanchor);

    return () => {
      cancelled = true;
    };
  }, [olderMessages]);

  function handleJumpToMessage(messageId: string) {
    const el = document.getElementById(`nc-msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(messageId);
    window.setTimeout(() => {
      setHighlightedId((current) => (current === messageId ? null : current));
    }, HIGHLIGHT_MS);
  }

  const isDeleted = conversation.participant.deleted;
  const disabledMsg = isDeleted
    ? "Cet utilisateur n'est plus membre du Notion Club"
    : undefined;

  // useCallback : référence stable passée en prop à chaque MessageBubble (memo)
  // → les bulles ne se re-rendent pas quand ConversationThread re-render pour
  // une raison sans rapport.
  const handleReply = useCallback(
    (target: Message) => {
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
    },
    [currentUser.id, currentUser.name, conversation.participant.name],
  );

  async function handleSend(
    body: string,
    type: "text" | "pdf" | "image" = "text",
    fileUrl?: string,
    fileName?: string,
  ) {
    // Capture le replyContext avant reset, pour le passer au parent ET dans
    // le state optimistic (les nouveaux messages doivent afficher la quote
    // immédiatement, sans attendre la réponse serveur).
    const reply = replyContext;
    setReplyContext(null);

    // Optimistic — affiché instantanément. On stocke fileUrl/fileName pour
    // matcher le shape DB. L'id `pending-…` sera purgé une fois la vraie ligne
    // DB réconciliée par le parent (qui l'insère dans conversation.messages).
    const pendingId = `pending-${Date.now()}`;
    setOptimisticMessages((prev) => [
      ...prev,
      {
        id: pendingId,
        senderId: currentUser.id,
        type,
        body,
        fileUrl,
        fileName,
        reactions: [],
        createdAt: new Date().toISOString(),
        replyToMessageId: reply?.messageId ?? null,
        replySnippet: reply?.snippet ?? null,
        replyAuthorName: reply?.authorName ?? null,
      },
    ]);
    // Le parent renvoie le message DB (ou null si échec). Succès → la vraie
    // ligne arrive via conversation.messages, on retire le pending (pas de
    // doublon). Échec → on retire aussi le pending (le toast est déjà affiché).
    await onSendMessage(body, reply, type !== "text" ? { type, fileUrl, fileName } : undefined);
    setOptimisticMessages((prev) => prev.filter((m) => m.id !== pendingId));
  }

  return (
    <div data-fb-label="Thread de messages · Communauté" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Thread header */}
      <div
        data-fb-label="En-tête · Thread de messages"
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
            data-fb-label="Bouton Retour liste · Thread de messages"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "none", background: "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-text-secondary)", flexShrink: 0,
            }}
            className="hover:bg-[rgba(0,0,0,0.06)]"
          >
            <ArrowReturn size={16} />
          </button>
        )}
        <UserAvatar user={conversation.participant} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
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
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          data-fb-label="Bouton Rechercher · Thread de messages"
          aria-label={searchOpen ? "Fermer la recherche" : "Rechercher dans la conversation"}
          aria-pressed={searchOpen}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "none",
            background: searchOpen ? "rgba(224,98,90,0.08)" : "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: searchOpen ? "var(--color-brand)" : "var(--color-text-secondary)",
            flexShrink: 0,
            transition: "background 120ms var(--nc-ease)",
          }}
          className="hover:bg-[rgba(0,0,0,0.06)]"
        >
          <Search size={16} />
        </button>
      </div>

      {/* Barre de recherche (optionnelle) — au-dessus du flux de messages */}
      {searchOpen && (
        <MessageSearchBar
          conversationId={conversation.id}
          currentUser={currentUser}
          participant={conversation.participant}
          onJumpToMessage={handleJumpToMessage}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        data-fb-label="Liste des messages · Thread de messages"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* Bouton "Charger plus" en haut, visible uniquement si la conv
            contient des messages plus anciens non encore chargés. */}
        {hasMore && messages.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <button
              type="button"
              onClick={handleLoadOlder}
              disabled={isLoadingOlder}
              data-fb-label="Bouton Charger messages précédents · Thread de messages"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid var(--color-border-default)",
                // Bouton posé sur la liste des messages (surface-card) →
                // surface-raised pour contraster. Cf. règle `.nc-btn-on-card`.
                background: "var(--color-surface-raised)",
                fontSize: 13,
                color: "var(--color-text-secondary)",
                cursor: isLoadingOlder ? "default" : "pointer",
                opacity: isLoadingOlder ? 0.6 : 1,
                transition: "background 120ms var(--nc-ease)",
              }}
              className="hover:bg-[rgba(0,0,0,0.04)]"
            >
              {isLoadingOlder ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Chargement…
                </>
              ) : (
                "Charger les messages précédents"
              )}
            </button>
          </div>
        )}

        {/* Trois états en escalier :
            1. loading ET aucun message en local → skeleton (premier chargement).
            2. messages.length === 0 ET pas loading → vrai état vide (conv neuve).
            3. sinon → on rend les bulles. */}
        {/* Reveal skeleton → messages (transitions.dev 14) au premier chargement
            de la conversation. contentStyle reprend le gap des bulles (le wrapper
            de contenu n'impose sinon aucune mise en page). */}
        <SkeletonReveal
          loading={Boolean(loading) && messages.length === 0}
          skeleton={<MessageBubbleSkeleton />}
          contentStyle={{ display: "flex", flexDirection: "column", gap: 4 }}
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
                highlighted={highlightedId === msg.id}
                lockedMessageId={lockedMessageId}
                onLockChange={setLockedMessageId}
              />
            ))
          )}
        </SkeletonReveal>
        {/* Indicateur "X écrit…" — affiché en bas, dans le flux des messages
            mais hors du tableau lui-même, pour qu'il n'ait pas besoin d'un
            faux ID stable. */}
        {otherIsTyping && !isDeleted && (
          <TypingIndicator authorName={conversation.participant.name} />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <MessageComposer
        onSend={handleSend}
        onTyping={emitTyping}
        disabled={isDeleted}
        disabledMessage={disabledMsg}
        replyContext={replyContext ?? undefined}
        onCancelReply={() => setReplyContext(null)}
      />
    </div>
  );
}
