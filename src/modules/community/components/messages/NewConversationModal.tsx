"use client";

import { useState } from "react";
import { X, Search } from "lucide-react";
import type { User } from "../../types/user.types";
import { MOCK_USERS } from "../../mocks/users.mock";
import { canDMUser } from "../../utils/dm-rules";
import { UserAvatar } from "../shared/UserAvatar";
import { RestrictedTooltip } from "../shared/RestrictedTooltip";

interface NewConversationModalProps {
  currentUser: User;
  onClose: () => void;
  onSelect: (userId: string) => void;
}

export function NewConversationModal({ currentUser, onClose, onSelect }: NewConversationModalProps) {
  const [query, setQuery] = useState("");

  const candidates = MOCK_USERS.filter(
    (u) => !u.deleted && u.id !== currentUser.id && !u.id.startsWith("self-")
  );

  const filtered = query
    ? candidates.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
    : candidates;

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
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 20,
          width: "100%",
          maxWidth: 440,
          overflow: "hidden",
          animation: "nc-mode-in var(--nc-duration-fast) var(--nc-ease) both",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--color-border-default)",
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nouvelle conversation</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", display: "flex" }}>
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
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, outline: "none", color: "var(--color-text-primary)" }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {filtered.map((user) => {
            const allowed = canDMUser(currentUser, user);
            const row = (
              <button
                key={user.id}
                type="button"
                onClick={() => { if (allowed) { onSelect(user.id); onClose(); } }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  border: "none",
                  background: "transparent",
                  cursor: allowed ? "pointer" : "not-allowed",
                  opacity: allowed ? 1 : 0.45,
                  textAlign: "left",
                  transition: "background 150ms ease",
                }}
                className={allowed ? "hover:bg-[rgba(0,0,0,0.04)]" : ""}
              >
                <UserAvatar user={user} size={40} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    {user.role === "admin" ? "Admin" : user.role === "mentor" ? "Mentor" : user.offer === "paid" ? "Accompagnement" : "Challenge gratuit"}
                  </div>
                </div>
              </button>
            );

            if (!allowed) {
              const offer = user.offer === "paid" ? "Accompagnement" : "Challenge gratuit";
              return (
                <RestrictedTooltip key={user.id} message={`Réservé aux membres ${offer}`}>
                  {row}
                </RestrictedTooltip>
              );
            }
            return row;
          })}
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
