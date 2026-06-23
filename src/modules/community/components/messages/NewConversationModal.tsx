"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { X, Search } from "lucide-react";
import type { User } from "../../types/user.types";
import { listMembersAction } from "../../server/actions";
import type { CommunityMember } from "../../server/queries";
import { UserAvatar } from "../shared/UserAvatar";
import { useModalTransition } from "@/shared/lib/hooks/useModalTransition";

interface NewConversationModalProps {
  currentUser: User;
  /** Centre du bouton déclencheur (viewport px) → origine du morph. */
  origin?: { x: number; y: number } | null;
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

export function NewConversationModal({ currentUser, origin, onClose, onSelect }: NewConversationModalProps) {
  const { stateClass, overlayOpen, requestClose } = useModalTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  // Origine du morph convertie en coordonnées locales au panneau (le panneau est
  // centré ; transform-origin peut pointer hors de sa boîte → croissance depuis
  // le bouton). Sans origine, fallback centre via le défaut CSS.
  const [originVars, setOriginVars] = useState<CSSProperties>({});
  const [query, setQuery] = useState("");
  // Liste réelle des membres tirée via Server Action. La RLS two-silo
  // (mig. 024) tranchera côté serveur si l'utilisateur clique sur un
  // member d'un autre tier. UX simple : on n'expose pas la règle ici, on
  // affiche un toast d'erreur si la création échoue.
  const [members, setMembers] = useState<CommunityMember[]>([]);

  useEffect(() => {
    let cancelled = false;
    listMembersAction().then((list) => {
      if (cancelled) return;
      setMembers(list.filter((m) => m.id !== currentUser.id));
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!origin || !el) return;
    // offsetLeft/offsetTop = position de mise en page (NON affectée par le
    // transform scale en cours, contrairement à getBoundingClientRect) →
    // origine locale exacte. offsetParent = l'overlay fixed (viewport 0,0).
    setOriginVars({
      ["--morph-mx" as string]: `${origin.x - el.offsetLeft}px`,
      ["--morph-my" as string]: `${origin.y - el.offsetTop}px`,
    });
  }, [origin]);

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
        ref={panelRef}
        data-fb-label="Modale Nouvelle conversation · Communauté"
        className={`t-modal-morph ${stateClass}`}
        role="dialog"
        aria-modal="true"
        style={{
          background: "var(--color-surface-card)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 440,
          overflow: "hidden",
          ...originVars,
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

        {/* List */}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
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
        </div>
      </div>
    </div>
  );
}
