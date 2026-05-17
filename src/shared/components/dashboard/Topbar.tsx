"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Calendar,
  Bell,
  type LucideIcon,
} from "lucide-react";

type NavItem = { label: string; icon: LucideIcon; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Formation", icon: BookOpen, href: "/formation" },
  { label: "Communauté", icon: Users, href: "/communaute" },
  { label: "Coaching", icon: Calendar, href: "/coaching" },
];

const MOCK_USER = { prenom: "Théo", nom: "Martin" };
const UNREAD_COUNT = 2;

const DROPDOWN_ITEMS = [
  { label: "Mon profil", href: "/profil", danger: false },
  { label: "Réglages", href: "/reglages", danger: false },
  { label: "Se déconnecter", href: "/login", danger: true },
];

function getInitials(prenom: string, nom: string) {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();
}

export function Topbar() {
  const pathname = usePathname();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!avatarOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [avatarOpen]);

  const initials = getInitials(MOCK_USER.prenom, MOCK_USER.nom);

  return (
    /*
     * hidden md:flex — gère le responsive directement sur l'élément racine
     * pour que sticky top-0 fonctionne depuis le conteneur flex-col parent,
     * sans div wrapper intermédiaire qui briserait le scroll-container.
     */
    <header
      className="hidden md:flex items-center justify-between sticky top-0 z-50"
      style={{
        height: 56,
        background: "#ffffff",
        borderBottom: "0.5px solid #e5e7eb",
        borderRadius: "0 0 20px 20px",
        boxShadow:
          "0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)",
        padding: "0 24px",
      }}
    >
      {/* ── Gauche : logo + séparateur + nav ── */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* Logo pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 11px 5px 9px",
            background: "#000",
            color: "#fff",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          Notion Club
          <span
            className="nc-blink-dot"
            style={{ width: 6, height: 6, flexShrink: 0 }}
          />
        </div>

        {/* Séparateur vertical */}
        <div
          style={{
            width: 0.5,
            height: 20,
            background: "#e5e7eb",
            margin: "0 12px",
            flexShrink: 0,
          }}
        />

        {/* Nav pills */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#fff" : "#52525b",
                  background: isActive ? "#000" : "transparent",
                  textDecoration: "none",
                  transition: "background 150ms ease, color 150ms ease",
                  whiteSpace: "nowrap",
                }}
                className={!isActive ? "hover:bg-[#f5f5f5] hover:text-black" : ""}
              >
                <Icon
                  size={14}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ flexShrink: 0 }}
                />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Droite : cloche + avatar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Cloche */}
        <button
          type="button"
          aria-label="Notifications"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "0.5px solid #e5e7eb",
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#52525b",
            position: "relative",
            flexShrink: 0,
            transition: "background 150ms ease",
          }}
          className="hover:bg-[#f5f5f5]"
        >
          <Bell size={14} />
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 15,
              height: 15,
              background: "#e0625a",
              color: "white",
              borderRadius: 9999,
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid white",
              padding: "0 3px",
              lineHeight: 1,
            }}
          >
            {UNREAD_COUNT}
          </span>
        </button>

        {/* Avatar + dropdown */}
        <div ref={avatarRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label="Menu compte"
            onClick={() => setAvatarOpen((o) => !o)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#e0625a",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.02em",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              transition: "opacity 150ms ease",
            }}
            className="hover:opacity-90"
          >
            {initials}
          </button>

          {avatarOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: 168,
                borderRadius: 16,
                boxShadow:
                  "rgba(0,0,0,0.03) 0px -2px 16px -4px, rgba(0,0,0,0.08) 0px 16px 40px -8px, rgba(0,0,0,0.04) 0px 1px 3px 0px",
                background: "white",
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                zIndex: 60,
              }}
            >
              {DROPDOWN_ITEMS.map((item, idx) => (
                <div key={item.href}>
                  {/* Séparateur avant "Se déconnecter" */}
                  {idx === DROPDOWN_ITEMS.length - 1 && (
                    <div
                      style={{
                        height: 1,
                        background: "#e5e7eb",
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
                      color: item.danger ? "#e0625a" : "#000",
                      textDecoration: "none",
                      transition: "background 150ms ease",
                    }}
                    className="hover:bg-[#f5f5f5]"
                  >
                    {item.label}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
