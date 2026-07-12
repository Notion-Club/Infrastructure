"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Forward, Check } from "lucide-react";
import { toast } from "sonner";
import type { User } from "../../types/user.types";
import { forwardMessageAction } from "../../server/actions";
import type { CommunityMember } from "../../server/queries";
import { FORWARD_MAX_TARGETS } from "../../lib/validation";
import { useMembersList } from "../../hooks/useMembersList";
import { UserAvatar } from "../shared/UserAvatar";
import { useModalTransition } from "@/shared/lib/hooks/useModalTransition";

interface ForwardMessageModalProps {
  currentUser: User;
  messageId: string;
  // Preview du message à transférer pour afficher un récap au-dessus de la
  // liste de targets (rassure l'user sur ce qu'il s'apprête à envoyer).
  messageSnippet: string;
  onClose: () => void;
  onDone: () => void;
}

// Shim CommunityMember → User pour UserAvatar (qui attend un User complet
// pour calculer le hash de couleur de fallback).
function memberAsUserShape(m: CommunityMember): User {
  return {
    id: m.id,
    name: m.name,
    username: m.username,
    avatarUrl: m.avatarUrl,
    avatarColor: null,
    initials: m.initials,
    role: "member",
    offer: "free",
    joinedAt: "",
  };
}

export function ForwardMessageModal({
  currentUser,
  messageId,
  messageSnippet,
  onClose,
  onDone,
}: ForwardMessageModalProps) {
  const { stateClass, overlayOpen, requestClose } = useModalTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);

  // OPS-99 v3 — Cache module-level via hook partagé. Première ouverture =
  // fetch (~200-700ms). Toutes les suivantes = instantané. Le hook gère
  // aussi le partage entre composants (NewConversationModal pourra
  // bénéficier du même cache en migrant plus tard).
  const { members: allMembers, loading, error: fetchError } = useMembersList();

  // Filtre l'utilisateur courant — pas de self-forward. useMemo pour ne
  // pas recalculer à chaque keypress dans la search.
  const members = useMemo<CommunityMember[]>(
    () =>
      currentUser?.id
        ? allMembers.filter((m) => m.id !== currentUser.id)
        : allMembers,
    [allMembers, currentUser?.id],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll + Echap close — pattern identique au lightbox du
  // composer. Évite que la page scrolle derrière le modal.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose(onClose);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, requestClose]);

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < FORWARD_MAX_TARGETS) {
        next.add(id);
      } else {
        toast.info(`Maximum ${FORWARD_MAX_TARGETS} destinataires par transfert.`);
      }
      return next;
    });
  }

  async function handleSend() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    const result = await forwardMessageAction({
      message_id: messageId,
      target_user_ids: Array.from(selected),
    });
    setSending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(
      `Message transféré à ${result.deliveredCount} destinataire${result.deliveredCount > 1 ? "s" : ""}`,
    );
    requestClose(onDone);
  }

  if (!mounted) return null;

  const filtered = query.trim()
    ? members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    : members;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Transférer le message"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose(onClose);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        opacity: overlayOpen ? 1 : 0,
        transition: "opacity var(--modal-open-dur) var(--modal-ease)",
      }}
    >
      <div
        data-fb-label="Modale Transférer le message · Communauté"
        className={`t-modal ${stateClass}`}
        style={{
          background: "var(--color-surface-card)",
          borderRadius: 16,
          width: "min(440px, 100%)",
          maxHeight: "min(640px, 90vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "var(--nc-shadow-3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--color-border-default)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Forward size={16} style={{ color: "var(--color-brand)" }} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
              Transférer le message
            </h2>
          </div>
          <button
            type="button"
            onClick={() => requestClose(onClose)}
            aria-label="Fermer"
            data-fb-label="Bouton Fermer · Modale Transférer le message"
            style={{
              width: 28,
              height: 28,
              border: "none",
              background: "transparent",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-muted)",
            }}
            className="hover:bg-[rgba(0,0,0,0.06)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Snippet du message à transférer */}
        <div
          style={{
            padding: "12px 18px",
            background: "var(--color-surface-raised)",
            borderBottom: "1px solid var(--color-border-default)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 4,
            }}
          >
            Message
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {messageSnippet}
          </p>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--color-border-default)" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-text-muted)",
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un membre…"
              data-fb-label="Champ de recherche membre · Modale Transférer le message"
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                border: "1px solid var(--color-border-default)",
                borderRadius: 10,
                fontSize: 13,
                background: "var(--color-surface-raised)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--color-text-muted)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{selected.size} / {FORWARD_MAX_TARGETS} sélectionnés</span>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--color-brand)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Tout déselectionner
              </button>
            )}
          </div>
        </div>

        {/* Members list */}
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {loading ? (
            // Skeleton — 5 lignes grises animées pulse pour donner un
            // feedback visuel cohérent avec MessageBubbleSkeleton du thread.
            // Beaucoup plus rassurant que le texte "Chargement…" qui peut
            // donner l'impression que rien ne se passe.
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                  }}
                  className="animate-pulse"
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--color-surface-raised)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div
                      style={{
                        width: `${50 + (i * 7) % 30}%`,
                        height: 12,
                        borderRadius: 4,
                        background: "var(--color-surface-raised)",
                      }}
                    />
                    <div
                      style={{
                        width: "30%",
                        height: 10,
                        borderRadius: 4,
                        background: "var(--color-surface-raised)",
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </div>
              ))}
            </>
          ) : fetchError ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "var(--color-brand)",
                fontSize: 13,
              }}
            >
              {fetchError}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 13,
              }}
            >
              {query.trim() ? "Aucun membre trouvé" : "Aucun autre membre disponible"}
            </div>
          ) : (
            filtered.map((m) => {
              const isSelected = selected.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  data-fb-label="Carte membre · Modale Transférer le message"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: "none",
                    background: isSelected ? "rgba(224,98,90,0.08)" : "transparent",
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 120ms var(--nc-ease)",
                  }}
                  className="hover:bg-[rgba(0,0,0,0.04)]"
                >
                  <UserAvatar user={memberAsUserShape(m)} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.name}
                    </div>
                    {m.role === "admin" || m.role === "mentor" ? (
                      <div style={{ fontSize: 11, color: "var(--color-brand)" }}>
                        {m.role === "admin" ? "Admin" : "Mentor"}
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: isSelected
                        ? "none"
                        : "1.5px solid var(--color-border-default)",
                      background: isSelected ? "var(--color-brand)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all var(--nc-duration-xfast) var(--nc-ease)",
                    }}
                  >
                    {isSelected && <Check size={14} color="#fff" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--color-border-default)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => requestClose(onClose)}
            disabled={sending}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--color-border-default)",
              background: "transparent",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              cursor: sending ? "not-allowed" : "pointer",
              opacity: sending ? 0.6 : 1,
            }}
            className="hover:bg-[rgba(0,0,0,0.04)]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={selected.size === 0 || sending}
            data-fb-label="Bouton Transférer · Modale Transférer le message"
            style={{
              padding: "8px 18px",
              border: "none",
              background:
                selected.size === 0 || sending
                  ? "var(--nc-btn-disabled-bg)"
                  : "var(--color-brand)",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color:
                selected.size === 0 || sending
                  ? "var(--nc-btn-disabled-text)"
                  : "#fff",
              cursor: selected.size === 0 || sending ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Forward size={14} />
            {sending ? "Envoi…" : `Transférer (${selected.size})`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
