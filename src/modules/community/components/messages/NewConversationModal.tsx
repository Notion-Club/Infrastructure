"use client";

import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import type { User } from "../../types/user.types";
import { listMembersAction } from "../../server/actions";
import type { CommunityMember } from "../../server/queries";
import { UserAvatar } from "../shared/UserAvatar";
import { SkeletonReveal } from "@/shared/components/SkeletonReveal";
import { useModalTransition } from "@/shared/lib/hooks/useModalTransition";

// Ligne squelette d'un membre — calquée sur la vraie carte membre (avatar 40 +
// nom + sous-titre, mêmes paddings/gap) pour que la modale s'ouvre à sa TAILLE
// FINALE et que la liste se révèle (transitions.dev 14-skeleton-reveal) sans
// saut de hauteur quand les membres arrivent.
const SKEL_PULSE = {
  background: "var(--color-surface-raised)",
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
} as const;

function MemberRowSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
      <div style={{ ...SKEL_PULSE, width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ ...SKEL_PULSE, height: 12, width: "45%", borderRadius: 6 }} />
        <div style={{ ...SKEL_PULSE, height: 10, width: "28%", borderRadius: 6 }} />
      </div>
    </div>
  );
}

function MemberListSkeleton() {
  return (
    <div aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <MemberRowSkeleton key={i} />
      ))}
    </div>
  );
}

interface NewConversationModalProps {
  currentUser: User;
  onClose: () => void;
  onSelect: (userId: string) => void;
}

// Shim local CommunityMember → User pour UserAvatar (qui attend un User
// complet). avatarColor / role / offer ne sont pas utilisés par les vignettes
// 40px du picker (juste le hash de couleur de fallback).
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

export function NewConversationModal({ currentUser, onClose, onSelect }: NewConversationModalProps) {
  const { stateClass, overlayOpen, requestClose } = useModalTransition();
  const [query, setQuery] = useState("");
  // Liste réelle des membres tirée via Server Action. La RLS two-silo
  // (mig. 024) tranchera côté serveur si l'utilisateur clique sur un
  // member d'un autre tier. UX simple : on n'expose pas la règle ici, on
  // affiche un toast d'erreur si la création échoue.
  const [members, setMembers] = useState<CommunityMember[]>([]);
  // true tant que la Server Action n'a pas répondu → on affiche un squelette de
  // liste (et non « Aucun membre trouvé », qui s'affichait instantanément à tort
  // puis se faisait remplacer en changeant la taille de la modale).
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listMembersAction()
      .then((list) => {
        if (cancelled) return;
        setMembers(list.filter((m) => m.id !== currentUser.id));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const filtered = query
    ? members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    : members;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
        opacity: overlayOpen ? 1 : 0,
        transition: "opacity var(--modal-open-dur) var(--modal-ease)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(onClose); }}
    >
      <div
        data-fb-label="Modale Nouvelle conversation · Communauté"
        className={`t-modal ${stateClass}`}
        role="dialog"
        aria-modal="true"
        style={{
          background: "var(--color-surface-card)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 440,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--color-border-default)",
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nouvelle conversation</h3>
          <button type="button" onClick={() => requestClose(onClose)} data-fb-label="Bouton Fermer · Modale Nouvelle conversation" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", display: "flex" }}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-default)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--color-surface-raised)", borderRadius: 9999, padding: "8px 14px",
            border: "1px solid var(--color-border-default)",
          }}>
            <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Rechercher un membre…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-fb-label="Champ de recherche membre · Modale Nouvelle conversation"
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, outline: "none", color: "var(--color-text-primary)" }}
            />
          </div>
        </div>

        {/* List — squelette pendant le chargement (la modale s'ouvre à sa
            taille finale), puis révélation en fondu/flou (transitions.dev 14). */}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <SkeletonReveal loading={loading} skeleton={<MemberListSkeleton />}>
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => requestClose(() => { onSelect(m.id); onClose(); })}
              data-fb-label="Carte membre · Modale Nouvelle conversation"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 150ms ease",
              }}
              className="hover:bg-[rgba(0,0,0,0.04)]"
            >
              <UserAvatar user={memberAsUserShape(m)} size={40} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {m.name}
                </div>
                {/* Sous-titre : on privilégie role > username pour rester
                    cohérent avec le style picker Théo (PR #87) qui affichait
                    "Admin / Mentor / Membre". offer (Accompagnement / Challenge
                    gratuit) n'est pas exposé via CommunityMember en V1 — pour
                    le restituer pleinement il faudra dériver les memberships
                    et enrichir le type côté serveur. */}
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {m.role === "admin"
                    ? "Admin"
                    : m.role === "mentor"
                      ? "Mentor"
                      : m.username
                        ? `@${m.username}`
                        : "Membre"}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "var(--color-text-muted)" }}>
              Aucun membre trouvé
            </div>
          )}
          </SkeletonReveal>
        </div>
      </div>
    </div>
  );
}
