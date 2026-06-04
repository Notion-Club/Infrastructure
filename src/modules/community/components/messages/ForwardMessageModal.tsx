"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Forward, Check } from "lucide-react";
import { toast } from "sonner";
import type { User } from "../../types/user.types";
import { forwardMessageAction, listMembersAction } from "../../server/actions";
import type { CommunityMember } from "../../server/queries";
import { FORWARD_MAX_TARGETS } from "../../lib/validation";
import { UserAvatar } from "../shared/UserAvatar";

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
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  // OPS-99 — État de chargement explicite. Avant : on affichait "Aucun membre
  // trouvé" dès le premier render alors que la query n'était pas encore
  // résolue, ce qui donnait l'impression d'un bug même quand la liste finissait
  // par arriver. Maintenant, on distingue "en cours de chargement" vs "vraiment
  // vide" pour que l'utilisateur ait un feedback visuel correct.
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // OPS-99 v2 — fix confirmé par les runtime logs Vercel. La Server Action
    // `listMembersAction` partait bien (2 requêtes Supabase 200 OK visibles)
    // mais le state React ne se mettait jamais à jour, restant figé sur
    // "Chargement des membres…".
    //
    // Cause : le pattern `let alive = true` + cleanup `alive = false` causait
    // un échec en combinaison avec React 19 StrictMode (double-mount). Le
    // premier effect lance la promesse PUIS son cleanup met `alive = false`.
    // La closure de la promesse capture cette variable → quand la résolution
    // arrive, `if (!alive) return` court-circuite. Le second effect crée
    // un NOUVEAU `alive = true` mais sa propre promesse peut aussi être
    // cleanup avant résolution si le parent re-render (ex: lockedMessageId
    // qui passe à null après fermeture du menu kebab).
    //
    // Fix : on supprime totalement le guard `alive`. En React 19 le setState
    // après unmount est inoffensif (warning console au pire, plus de crash
    // depuis React 18+). Mieux vaut un setState orphelin qu'un état figé
    // qui rend la modale inutilisable.
    setLoading(true);
    setFetchError(null);

    listMembersAction()
      .then((list) => {
        const filtered = currentUser?.id
          ? list.filter((m) => m.id !== currentUser.id)
          : list;
        setMembers(filtered);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[ForwardMessageModal] listMembersAction failed:", err);
        setFetchError("Impossible de charger la liste des membres.");
        setLoading(false);
      });
  }, [currentUser?.id]);

  // Lock body scroll + Echap close — pattern identique au lightbox du
  // composer. Évite que la page scrolle derrière le modal.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

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
    onDone();
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
        if (e.target === e.currentTarget) onClose();
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
        animation: "nc-mode-in 180ms var(--nc-ease) both",
      }}
    >
      <div
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
            onClick={onClose}
            aria-label="Fermer"
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
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 13,
              }}
            >
              Chargement des membres…
            </div>
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
                    transition: "background 120ms ease",
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
                      transition: "all 150ms ease",
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
            onClick={onClose}
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
