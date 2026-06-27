"use client";

import { memo, useEffect, useRef, useState, useTransition } from "react";
import { FileText, Forward, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "../../types/conversation.types";
import { timeAgo, fullDateTime } from "../../utils/date-helpers";
import { linkify } from "../../utils/linkify";
import { useUserTopEmojis } from "../../hooks/useUserTopEmojis";
import { prefetchMembersList } from "../../hooks/useMembersList";
import {
  deleteMessageAction,
  editMessageAction,
  toggleMessageReactionAction,
} from "../../server/actions";
import { MessageToolbar } from "./MessageToolbar";
import { ForwardMessageModal } from "./ForwardMessageModal";
import { DeletePostConfirmDialog } from "../shared/DeletePostConfirmDialog";
import type { User } from "../../types/user.types";

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  currentUser: User;
  // Le parent gère le composer en mode quote-reply : clic sur Répondre →
  // setReplyContext({...}) côté ConversationThread, qui le passe au composer.
  onReply: (message: Message) => void;
  // true quand un résultat de recherche pointe vers ce message — affiche un
  // halo brand quelques secondes pour aider l'utilisateur à le repérer.
  highlighted?: boolean;
  // ID du message dont la toolbar est verrouillée ouverte (picker ou kebab
  // menu déployé). Quand non-null et différent de ce message : on n'affiche
  // PAS la toolbar même au hover, pour éviter qu'elle vienne masquer celle
  // qui est en cours d'utilisation. État remonté au parent ConversationThread
  // pour être partagé entre toutes les bulles.
  lockedMessageId: string | null;
  onLockChange: (messageId: string | null) => void;
}

function MessageBubbleInner({
  message,
  isSelf,
  currentUser,
  onReply,
  highlighted,
  lockedMessageId,
  onLockChange,
}: MessageBubbleProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(message.body);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [localReactions, setLocalReactions] = useState(message.reactions);
  const [, startTransition] = useTransition();
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const topEmojis = useUserTopEmojis();

  // États dérivés pour le verrouillage. Quand un AUTRE message est locked,
  // ce message-ci masque sa toolbar même au hover (évite les chevauchements).
  // Quand CE message est locked, la toolbar reste visible même si on sort
  // de la bulle (sinon impossible d'aller cliquer dans le menu déroulant).
  const isThisLocked = lockedMessageId === message.id;
  const isAnotherLocked = lockedMessageId !== null && lockedMessageId !== message.id;

  // Resync l'état local quand le parent re-render avec un message mis à
  // jour (router.refresh après edit / reaction toggle).
  useEffect(() => {
    setLocalReactions(message.reactions);
    if (!editing) setEditBody(message.body);
  }, [message.body, message.reactions, editing]);

  // Le mode édition focus auto le textarea.
  useEffect(() => {
    if (editing) {
      editTextareaRef.current?.focus();
      editTextareaRef.current?.setSelectionRange(editBody.length, editBody.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Un message en cours de persistance porte un id "pending-…". Pas d'actions
  // destructives ni de réaction tant qu'on n'a pas le vrai UUID DB.
  const isPending = message.id.startsWith("pending-");

  if (message.deleted) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: isSelf ? "flex-end" : "flex-start",
          margin: "4px 0",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
          Message supprimé
        </span>
      </div>
    );
  }

  // Set des emojis sur lesquels j'ai déjà réagi — pour highlight la toolbar.
  const myReactions = new Set(
    localReactions.filter((r) => r.userId === currentUser.id).map((r) => r.emoji),
  );

  // Groupement des réactions par emoji + flag "j'ai réagi à celui-ci".
  const grouped = localReactions.reduce<Record<string, { count: number; mine: boolean }>>(
    (acc, r) => {
      const entry = acc[r.emoji] ?? { count: 0, mine: false };
      entry.count += 1;
      if (r.userId === currentUser.id) entry.mine = true;
      acc[r.emoji] = entry;
      return acc;
    },
    {},
  );

  async function handleReact(emoji: string) {
    if (isPending) {
      toast.info("Attends la fin de l'envoi…");
      return;
    }
    // Optimistic toggle : on update localReactions, on revert si erreur.
    const previous = localReactions;
    setLocalReactions((prev) => {
      const idx = prev.findIndex(
        (r) => r.emoji === emoji && r.userId === currentUser.id,
      );
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { emoji, userId: currentUser.id }];
    });
    const result = await toggleMessageReactionAction({
      message_id: message.id,
      emoji,
    });
    if (!result.ok) {
      setLocalReactions(previous);
      toast.error(result.message);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    const result = await deleteMessageAction({ message_id: message.id });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Message supprimé");
  }

  function handleEditSubmit() {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed === message.body) {
      setEditing(false);
      setEditBody(message.body);
      return;
    }
    startTransition(async () => {
      const result = await editMessageAction({
        message_id: message.id,
        body: trimmed,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setEditing(false);
      toast.success("Message modifié");
    });
  }

  // Affordances kebab : mes msgs → Modifier/Supprimer/Transférer ;
  // msgs reçus → Transférer seul. isPending masque tout (id non-UUID).
  const canEdit = isSelf && !isPending && message.type === "text";
  const canDelete = isSelf && !isPending;
  const canForward = !isPending;

  return (
    <div
      id={`nc-msg-${message.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isSelf ? "flex-end" : "flex-start",
        // Le conteneur HUG son contenu (largeur de la bulle) et se cale à droite
        // (mes messages) / gauche (reçus) via alignSelf. Avant, il était pleine
        // largeur → survoler la gouttière vide déclenchait la toolbar (« trop
        // sensible »). Maintenant, seul le survol de la colonne-bulle l'arme.
        alignSelf: isSelf ? "flex-end" : "flex-start",
        width: "fit-content",
        maxWidth: "100%",
        margin: "2px 0",
        position: "relative",
        // Highlight déclenché par un clic sur un résultat de recherche.
        // Halo brand-tinted qui s'estompe en 1.8s via transition.
        boxShadow: highlighted ? "0 0 0 3px rgba(224,98,90,0.35)" : "none",
        borderRadius: highlighted ? 16 : undefined,
        transition: "box-shadow 600ms ease",
        // Quand le menu / picker est ouvert sur ce message, on monte la bulle
        // au-dessus des suivantes — sinon le dropdown (z-index local) est
        // recouvert par la bulle voisine qui crée son propre stacking
        // context (chaque bulle a position:relative).
        zIndex: isThisLocked ? 100 : undefined,
      }}
      onMouseEnter={() => {
        // Si un autre message est locked (menu déroulant ouvert ailleurs),
        // on n'affiche PAS la toolbar de celui-ci pour éviter le chevauchement.
        if (isAnotherLocked) return;
        setShowToolbar(true);
        // Prefetch best-effort de la liste des membres pour la modale
        // Forward. Si l'utilisateur clique "Transférer" derrière, la modale
        // s'affiche instantanément (cache déjà rempli) au lieu d'attendre
        // ~200-700ms le round-trip Server Action.
        // La fonction est no-op si déjà en cache → safe d'appeler à chaque
        // hover.
        if (!isPending) prefetchMembersList();
      }}
      onMouseLeave={() => {
        // Si CE message est locked (picker/menu ouvert), on garde la toolbar
        // visible — c'est le clic outside global qui la fermera.
        if (isThisLocked) return;
        setShowToolbar(false);
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          flexDirection: isSelf ? "row-reverse" : "row",
          maxWidth: "100%",
        }}
      >
        {/* Bulle */}
        <div
          data-fb-label="Bulle de message · Thread de messages"
          style={{
            maxWidth: 360,
            padding: "10px 14px",
            borderRadius: isSelf ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: isSelf ? "var(--color-brand)" : "var(--color-surface-raised)",
            color: isSelf ? "#fff" : "var(--color-text-primary)",
            border: isSelf ? "none" : "1px solid var(--color-border-default)",
            fontSize: 14,
            lineHeight: 1.5,
            wordBreak: "break-word",
            position: "relative",
          }}
        >
          {/* Badge Forwarded (mig. 028) */}
          {message.forwardedFromAuthorName && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontStyle: "italic",
                opacity: 0.8,
                marginBottom: 6,
                color: isSelf ? "rgba(255,255,255,0.85)" : "var(--color-text-muted)",
              }}
            >
              <Forward size={11} />
              Transféré de {message.forwardedFromAuthorName}
            </div>
          )}

          {/* Quote block (mig. 027) — message cité au-dessus du body */}
          {message.replySnippet && (
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 8,
                marginBottom: 6,
                padding: "6px 10px",
                background: isSelf ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.04)",
                borderRadius: 8,
                borderLeft: `3px solid ${isSelf ? "rgba(255,255,255,0.6)" : "var(--color-brand)"}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isSelf ? "rgba(255,255,255,0.9)" : "var(--color-brand)",
                    marginBottom: 2,
                  }}
                >
                  {message.replyAuthorName ?? "Auteur inconnu"}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: isSelf ? "rgba(255,255,255,0.8)" : "var(--color-text-secondary)",
                    lineHeight: 1.4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {message.replySnippet}
                </div>
              </div>
            </div>
          )}

          {/* Body : édition inline ou rendu normal */}
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea
                ref={editTextareaRef}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleEditSubmit();
                  } else if (e.key === "Escape") {
                    setEditing(false);
                    setEditBody(message.body);
                  }
                }}
                style={{
                  width: "100%",
                  minWidth: 180,
                  padding: "6px 8px",
                  border: "1px solid",
                  borderColor: isSelf ? "rgba(255,255,255,0.4)" : "var(--color-border-default)",
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "inherit",
                  background: isSelf ? "rgba(255,255,255,0.15)" : "var(--color-surface-card)",
                  color: isSelf ? "#fff" : "var(--color-text-primary)",
                  outline: "none",
                  resize: "vertical",
                }}
                rows={Math.min(Math.max(editBody.split("\n").length, 2), 6)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditBody(message.body);
                  }}
                  style={{
                    padding: "4px 8px",
                    border: "none",
                    background: "transparent",
                    color: isSelf ? "rgba(255,255,255,0.9)" : "var(--color-text-muted)",
                    fontSize: 12,
                    cursor: "pointer",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <X size={12} /> Annuler
                </button>
                <button
                  type="button"
                  onClick={handleEditSubmit}
                  style={{
                    padding: "4px 10px",
                    border: "none",
                    background: isSelf ? "rgba(255,255,255,0.2)" : "var(--color-brand)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Check size={12} /> Enregistrer
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.type === "text" && (
                <span style={{ whiteSpace: "pre-wrap" }}>{linkify(message.body)}</span>
              )}
              {message.type === "image" && message.fileUrl && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Slack-like : image taille modérée, click ouvre lightbox
                      globale (cf. ImageLightboxRoot via 'nc-image-open'). */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(
                        new CustomEvent("nc-image-open", {
                          detail: { url: message.fileUrl },
                        }),
                      );
                    }}
                    style={{
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "zoom-in",
                      display: "inline-block",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={message.fileUrl}
                      alt={message.fileName ?? ""}
                      style={{
                        maxWidth: 320,
                        maxHeight: 320,
                        borderRadius: 8,
                        display: "block",
                        objectFit: "cover",
                      }}
                      loading="lazy"
                    />
                  </button>
                  {/* Body texte optionnel accompagnant l'image */}
                  {message.body && (
                    <span style={{ whiteSpace: "pre-wrap" }}>{linkify(message.body)}</span>
                  )}
                </div>
              )}
              {message.type === "pdf" && message.fileUrl && (
                /* Rendu Slack-like pour les fichiers non-image. type "pdf"
                   est notre bucket DB générique pour tout fichier (PDF,
                   docx, zip, etc.) — on identifie le vrai format via
                   l'extension de fileName. */
                <a
                  href={message.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={message.fileName ?? undefined}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: isSelf ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.04)",
                    border: isSelf
                      ? "1px solid rgba(255,255,255,0.25)"
                      : "1px solid var(--color-border-default)",
                    color: "inherit",
                    textDecoration: "none",
                    maxWidth: 320,
                    transition: "background 150ms ease",
                  }}
                >
                  <FileText size={28} style={{ flexShrink: 0, opacity: 0.85 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {message.fileName ?? "Fichier"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                      }}
                    >
                      {(message.fileName?.split(".").pop() ?? "Fichier").slice(0, 6)}
                      {" "}· Télécharger
                    </div>
                  </div>
                </a>
              )}
              {/* Body texte optionnel accompagnant le fichier non-image */}
              {message.type === "pdf" && message.body && (
                <span style={{ whiteSpace: "pre-wrap", marginTop: 6, display: "block" }}>
                  {linkify(message.body)}
                </span>
              )}
            </>
          )}

          {/* Indicateur "modifié" — discret */}
          {message.editedAt && !editing && (
            <div
              style={{
                fontSize: 10,
                fontStyle: "italic",
                opacity: 0.7,
                marginTop: 2,
                color: isSelf ? "rgba(255,255,255,0.8)" : "var(--color-text-muted)",
              }}
              title={`Modifié le ${fullDateTime(message.editedAt)}`}
            >
              modifié
            </div>
          )}
        </div>
      </div>

      {/* Toolbar hover — OVERLAY absolu flottant JUSTE AU-DESSUS de la bulle,
          HORS du flux : son apparition ne pousse plus les pastilles/timestamp
          ni les bulles suivantes (fin de l'effet « tout tremble » au survol).
          `paddingBottom` = pont de survol : la zone reste contiguë de la bulle
          jusqu'à la toolbar (pas de trou qui couperait le hover). L'entrée est
          animée par .nc-mode-in (déjà sur la racine de MessageToolbar). */}
      {(showToolbar || isThisLocked) && !editing && !isPending && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            paddingBottom: 6,
            display: "flex",
            justifyContent: isSelf ? "flex-end" : "flex-start",
            zIndex: 3,
          }}
        >
          <MessageToolbar
            align={isSelf ? "right" : "left"}
            topEmojis={topEmojis}
            reactedEmojis={myReactions}
            onReact={handleReact}
            onReply={() => onReply(message)}
            onEdit={canEdit ? () => setEditing(true) : undefined}
            onDelete={canDelete ? () => setShowDeleteConfirm(true) : undefined}
            onForward={canForward ? () => setShowForwardModal(true) : undefined}
            onOpenChange={(open) => onLockChange(open ? message.id : null)}
          />
        </div>
      )}

      {/* Pastilles réactions sous la bulle */}
      {Object.keys(grouped).length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 4,
            marginTop: 4,
            flexWrap: "wrap",
            justifyContent: isSelf ? "flex-end" : "flex-start",
          }}
        >
          {Object.entries(grouped).map(([emoji, data]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReact(emoji)}
              data-fb-label={`Réaction ${emoji} · Bulle de message`}
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 9999,
                background: data.mine
                  ? "rgba(224,98,90,0.10)"
                  : "var(--color-surface-card)",
                border: `1px solid ${data.mine ? "var(--color-brand)" : "var(--color-border-default)"}`,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: data.mine ? "var(--color-brand)" : "var(--color-text-secondary)",
                fontWeight: data.mine ? 600 : 500,
                transition: "all 120ms ease",
              }}
            >
              {emoji} {data.count}
            </button>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3 }}>
        {timeAgo(message.createdAt)}
      </span>

      {showDeleteConfirm && (
        <DeletePostConfirmDialog
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showForwardModal && (
        <ForwardMessageModal
          currentUser={currentUser}
          messageId={message.id}
          messageSnippet={
            message.type === "text"
              ? message.body
              : message.fileName ?? "[Fichier]"
          }
          onClose={() => setShowForwardModal(false)}
          onDone={() => setShowForwardModal(false)}
        />
      )}
    </div>
  );
}

// Mémoïsé : une bulle ne se re-rend que si ses props changent réellement. Quand
// un message est envoyé/reçu, la liste grandit mais les bulles existantes
// gardent les mêmes props (onReply/onLockChange stabilisés côté
// ConversationThread) → plus de re-render en cascade de tout le thread.
export const MessageBubble = memo(MessageBubbleInner);
