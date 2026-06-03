"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FileText, Forward, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "../../types/conversation.types";
import { timeAgo, fullDateTime } from "../../utils/date-helpers";
import { linkify } from "../../utils/linkify";
import { useUserTopEmojis } from "../../hooks/useUserTopEmojis";
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
  // Callback pour scroller vers un message cité (quote-reply click).
  onScrollToMessage?: (id: string) => void;
}

export function MessageBubble({
  message,
  isSelf,
  currentUser,
  onReply,
  highlighted,
  lockedMessageId,
  onLockChange,
  onScrollToMessage,
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
  const isImage = message.type === "image" && !!message.fileUrl;

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
        margin: "2px 0",
        position: "relative",
        // Highlight déclenché par un clic sur un résultat de recherche.
        // Halo brand-tinted qui s'estompe en 1.8s via transition.
        boxShadow: highlighted ? "0 0 0 3px rgba(224,98,90,0.35)" : "none",
        borderRadius: highlighted ? 16 : undefined,
        transition: "box-shadow 600ms ease",
      }}
      onMouseEnter={() => {
        // Si un autre message est locked (menu déroulant ouvert ailleurs),
        // on n'affiche PAS la toolbar de celui-ci pour éviter le chevauchement.
        if (isAnotherLocked) return;
        setShowToolbar(true);
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
          style={{
            maxWidth: isImage ? 240 : 360,
            padding: isImage ? 0 : "10px 14px",
            borderRadius: isSelf ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: isImage ? "transparent" : isSelf ? "var(--color-surface-raised)" : "var(--color-brand)",
            color: isImage ? undefined : isSelf ? "var(--color-text-primary)" : "#fff",
            border: isImage ? "none" : isSelf ? "1px solid var(--color-border-default)" : "none",
            fontSize: 14,
            lineHeight: 1.5,
            wordBreak: "break-word",
            position: "relative",
            overflow: "hidden",
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
                color: isSelf ? "var(--color-text-muted)" : "rgba(255,255,255,0.85)",
              }}
            >
              <Forward size={11} />
              Transféré de {message.forwardedFromAuthorName}
            </div>
          )}

          {/* Quote block (mig. 027) — message cité au-dessus du body */}
          {message.replySnippet && (
            <div
              onClick={() => message.replyToMessageId && onScrollToMessage?.(message.replyToMessageId)}
              className={message.replyToMessageId ? "hover:opacity-70" : ""}
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 8,
                marginBottom: 6,
                padding: "6px 10px",
                background: isSelf ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.18)",
                borderRadius: 8,
                borderLeft: `3px solid ${isSelf ? "var(--color-brand)" : "rgba(255,255,255,0.6)"}`,
                cursor: message.replyToMessageId ? "pointer" : "default",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isSelf ? "var(--color-brand)" : "rgba(255,255,255,0.9)",
                    marginBottom: 2,
                  }}
                >
                  {message.replyAuthorName ?? "Auteur inconnu"}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: isSelf ? "var(--color-text-secondary)" : "rgba(255,255,255,0.8)",
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
                  borderColor: isSelf ? "var(--color-border-default)" : "rgba(255,255,255,0.4)",
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "inherit",
                  background: isSelf ? "var(--color-surface-card)" : "rgba(255,255,255,0.15)",
                  color: isSelf ? "var(--color-text-primary)" : "#fff",
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
                    color: isSelf ? "var(--color-text-muted)" : "rgba(255,255,255,0.9)",
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
                    background: isSelf ? "var(--color-brand)" : "rgba(255,255,255,0.2)",
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
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {/* iMessage-style : image remplit entièrement la bulle, click ouvre lightbox globale. */}
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
                      display: "block",
                      width: "100%",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={message.fileUrl}
                      alt={message.fileName ?? ""}
                      style={{
                        width: "100%",
                        maxHeight: 320,
                        display: "block",
                        objectFit: "cover",
                      }}
                      loading="lazy"
                    />
                  </button>
                  {/* Body texte optionnel accompagnant l'image */}
                  {message.body && (
                    <span style={{ padding: "8px 12px", whiteSpace: "pre-wrap", display: "block" }}>{linkify(message.body)}</span>
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
                    background: isSelf ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.18)",
                    border: isSelf
                      ? "1px solid var(--color-border-default)"
                      : "1px solid rgba(255,255,255,0.25)",
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
                color: isSelf ? "var(--color-text-muted)" : "rgba(255,255,255,0.8)",
              }}
              title={`Modifié le ${fullDateTime(message.editedAt)}`}
            >
              modifié
            </div>
          )}
        </div>
      </div>

      {/* Toolbar hover — positionnée SOUS la bulle plutôt qu'à côté. Avant :
          la toolbar était dans le flex row à droite de la bulle (gauche
          pour les msgs reçus), ce qui masquait les bulles voisines au
          hover. Maintenant : alignée comme les pastilles réactions, juste
          sous la bulle, alignée à droite (mes msgs) ou à gauche (reçus). */}
      {(showToolbar || isThisLocked) && !editing && !isPending && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            justifyContent: isSelf ? "flex-end" : "flex-start",
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
