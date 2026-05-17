"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Bell, X } from "lucide-react";
import { NotificationPopover } from "../NotificationPopover";

const MOCK_USER = {
  prenom: "Théo",
  nom: "Martin",
  avatarUrl: null as string | null,
};

const UNREAD_COUNT = 2;

type DropdownItem = {
  label: string;
  href: string;
  danger?: boolean;
};

const DROPDOWN_ITEMS: DropdownItem[] = [
  { label: "Mon profil", href: "/profil" },
  { label: "Réglages", href: "/reglages" },
  { label: "Déconnexion", href: "/login", danger: true },
];

function getInitials(prenom: string, nom: string) {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();
}

export function MobileHeader() {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const initials = getInitials(MOCK_USER.prenom, MOCK_USER.nom);

  useEffect(() => {
    if (!avatarOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarOpen]);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
      }}
    >
      {/* Main header bar */}
      <div
        style={{
          height: 60,
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(229,231,235,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          gap: 12,
        }}
      >
        {/* Left: Avatar + name */}
        <div ref={avatarRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Menu compte"
            onClick={() => setAvatarOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {/* Avatar */}
            {MOCK_USER.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={MOCK_USER.avatarUrl}
                alt={MOCK_USER.prenom}
                style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "var(--color-brand)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
            )}

            {/* Name + greeting */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1, textAlign: "left" }}>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1 }}>
                Bon retour
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  lineHeight: 1,
                }}
              >
                {MOCK_USER.prenom}
              </span>
            </div>
          </button>

          {/* Avatar dropdown */}
          {avatarOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                minWidth: 160,
                borderRadius: 16,
                boxShadow:
                  "rgba(0,0,0,0.03) 0px -2px 16px -4px, rgba(0,0,0,0.08) 0px 16px 40px -8px, rgba(0,0,0,0.04) 0px 1px 3px 0px",
                background: "white",
                border: "1px solid var(--color-border-default)",
                overflow: "hidden",
                zIndex: 60,
              }}
            >
              {DROPDOWN_ITEMS.map((item, idx) => (
                <div key={item.href}>
                  {idx === DROPDOWN_ITEMS.length - 1 && (
                    <div
                      style={{
                        height: 1,
                        background: "var(--color-border-default)",
                        margin: "4px 0",
                      }}
                    />
                  )}
                  <a
                    href={item.href}
                    role="menuitem"
                    style={{
                      display: "block",
                      padding: "10px 14px",
                      fontSize: 14,
                      color: item.danger ? "var(--color-brand)" : "var(--color-text-primary)",
                      textDecoration: "none",
                      transition: "background 150ms ease",
                    }}
                    className="hover:bg-[var(--color-surface-raised)]"
                  >
                    {item.label}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Search + Notifications */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Search button */}
          <button
            type="button"
            aria-label="Rechercher"
            onClick={() => setSearchOpen((o) => !o)}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "0.5px solid #e5e7eb",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              flexShrink: 0,
            }}
          >
            {searchOpen ? <X size={15} /> : <Search size={15} />}
          </button>

          {/* Notifications */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              aria-label={`${UNREAD_COUNT} notifications`}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: "0.5px solid #e5e7eb",
                background: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--color-text-secondary)",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <Bell size={15} />
              <span
                style={{
                  position: "absolute",
                  top: -3,
                  right: -3,
                  minWidth: 17,
                  height: 17,
                  background: "var(--color-brand)",
                  color: "white",
                  borderRadius: 9999,
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid white",
                  padding: "0 3px",
                  lineHeight: 1,
                }}
              >
                {UNREAD_COUNT}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Search bar slide-down */}
      {searchOpen && (
        <div
          style={{
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(229,231,235,0.8)",
            padding: "10px 16px",
            animation: "nc-mode-in 250ms cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "white",
              border: "1px solid var(--color-border-default)",
              borderRadius: 9999,
              padding: "10px 16px",
            }}
          >
            <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
            <input
              type="search"
              placeholder="Rechercher un cours, une ressource…"
              autoFocus
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 13,
                color: "var(--color-text-primary)",
                background: "transparent",
              }}
            />
          </div>
        </div>
      )}
    </header>
  );
}
