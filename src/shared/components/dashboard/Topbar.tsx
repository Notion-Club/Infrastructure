"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
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

const LOGO_SRC =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777034233/Notion_Club_-_Black_-_Sans_BG_hcvk9k.png";

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

const SEPARATOR = (
  <div
    aria-hidden
    style={{
      width: 0.5,
      height: 18,
      background: "#e5e7eb",
      flexShrink: 0,
      alignSelf: "center",
    }}
  />
);

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
     * Outer header : transparent + couleur de page → le contenu qui scroll
     * dessous ne transperce pas. sticky top-0 sur l'élément racine (enfant
     * direct du flex-col) pour que le scroll-container soit la page entière.
     * hidden md:flex justify-center → pill centrée, pas full-width.
     */
    <header
      className="hidden md:flex justify-center sticky top-0 z-50"
      style={{
        padding: "10px 24px",
        background: "var(--color-surface-page)",
      }}
    >
      {/* Pill flottante — largeur déterminée par son contenu */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          background: "#ffffff",
          border: "0.5px solid #e5e7eb",
          borderRadius: 9999,
          boxShadow:
            "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
          padding: "5px 6px 5px 12px",
        }}
      >
        {/* Logo */}
        <Image
          src={LOGO_SRC}
          alt="Notion Club"
          width={88}
          height={30}
          priority
          style={{ height: 22, width: "auto", display: "block", flexShrink: 0 }}
        />

        {SEPARATOR}

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
                  padding: "6px 13px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: "#000",
                  background: isActive
                    ? "rgba(0,0,0,0.07)"
                    : "transparent",
                  textDecoration: "none",
                  transition: "background 150ms ease",
                  whiteSpace: "nowrap",
                }}
                className={!isActive ? "hover:bg-[rgba(0,0,0,0.04)]" : ""}
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

        {SEPARATOR}

        {/* Cloche */}
        <button
          type="button"
          aria-label="Notifications"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#52525b",
            position: "relative",
            flexShrink: 0,
            transition: "background 150ms ease",
          }}
          className="hover:bg-[rgba(0,0,0,0.04)]"
        >
          <Bell size={15} />
          <span
            style={{
              position: "absolute",
              top: 1,
              right: 1,
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
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#e0625a",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.02em",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              transition: "opacity 150ms ease",
            }}
            className="hover:opacity-85"
          >
            {initials}
          </button>

          {avatarOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
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
