"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  BookOpen,
  Users,
  Calendar,
  Library,
  Bell,
  type LucideIcon,
} from "lucide-react";

import { ThemeToggle } from "@/shared/components/theme/ThemeToggle";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import {
  computeIdentityInitials,
  useProfileIdentityContext,
} from "@/shared/components/identity/ProfileIdentityProvider";

type NavItem = { label: string; icon: LucideIcon; href: string };

const LOGO_SRC =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777034233/Notion_Club_-_Black_-_Sans_BG_hcvk9k.png";

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: Home, href: "/dashboard" },
  { label: "Formation", icon: BookOpen, href: "/formation" },
  { label: "Communauté", icon: Users, href: "/communaute" },
  { label: "Coaching", icon: Calendar, href: "/coaching" },
  { label: "Ressources", icon: Library, href: "/ressources" },
];

const UNREAD_COUNT = 2;

const SEPARATOR = (
  <div
    aria-hidden
    style={{
      width: 0.5,
      height: 22,
      background: "#e5e7eb",
      flexShrink: 0,
      alignSelf: "center",
    }}
  />
);

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore — the redirect below brings the user back to login either way.
    } finally {
      router.push("/login");
    }
  }

  const { identity } = useProfileIdentityContext();
  const initials = computeIdentityInitials(identity);
  const avatarUrl = identity?.avatarUrl ?? null;
  const avatarColor = identity?.avatarColor ?? "#e0625a";

  return (
    <header
      className="hidden md:flex justify-center"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "14px 40px",
        background: "transparent",
        // Force a GPU layer so position:fixed isn't broken by ancestor
        // filters/transforms. Avoid `contain: paint` here — it would clip
        // the dropdown that extends below the header.
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      {/* Pill — élargie pour respirer avec 5 items de nav + groupe droit */}
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
          background: "#ffffff",
          border: "0.5px solid #e5e7eb",
          borderRadius: 9999,
          boxShadow:
            "0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)",
          padding: "10px 10px 10px 22px",
        }}
      >
        {/* ── Gauche : logo + séparateur + nav ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/dashboard"
            aria-label="Notion Club — retour à l'accueil"
            style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
          >
            <Image
              src={LOGO_SRC}
              alt="Notion Club"
              width={120}
              height={40}
              priority
              style={{ height: 32, width: "auto", display: "block", flexShrink: 0 }}
            />
          </Link>

          {SEPARATOR}

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
                    gap: 7,
                    padding: "9px 16px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    color: "#000",
                    background: isActive ? "rgba(0,0,0,0.07)" : "transparent",
                    textDecoration: "none",
                    transition: "background 150ms ease",
                    whiteSpace: "nowrap",
                  }}
                  className={!isActive ? "hover:bg-[rgba(0,0,0,0.04)]" : ""}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
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
              width: 40,
              height: 40,
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
            <Bell size={18} />
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
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
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: avatarUrl ? "transparent" : avatarColor,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.02em",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              transition: "opacity 150ms ease",
              overflow: "hidden",
              padding: 0,
            }}
            className="hover:opacity-85"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              initials
            )}
          </button>

          {avatarOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                minWidth: 220,
                borderRadius: 16,
                boxShadow:
                  "rgba(0,0,0,0.03) 0px -2px 16px -4px, rgba(0,0,0,0.08) 0px 16px 40px -8px, rgba(0,0,0,0.04) 0px 1px 3px 0px",
                background: "white",
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                zIndex: 60,
                padding: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 10px",
                }}
              >
                <span style={{ fontSize: 14, color: "#000" }}>
                  Mode sombre
                </span>
                <ThemeToggle />
              </div>
              <div
                style={{
                  height: 1,
                  background: "#e5e7eb",
                  margin: "4px 0",
                }}
              />
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setAvatarOpen(false)}
                style={{
                  display: "block",
                  padding: "10px 10px",
                  fontSize: 14,
                  color: "#000",
                  textDecoration: "none",
                  borderRadius: 10,
                  transition: "background 150ms ease",
                }}
                className="hover:bg-[#f5f5f5]"
              >
                Réglages
              </Link>
              <div
                style={{
                  height: 1,
                  background: "#e5e7eb",
                  margin: "4px 0",
                }}
              />
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                role="menuitem"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px",
                  fontSize: 14,
                  color: "#e0625a",
                  background: "transparent",
                  border: "none",
                  borderRadius: 10,
                  cursor: signingOut ? "wait" : "pointer",
                  opacity: signingOut ? 0.6 : 1,
                  transition: "background 150ms ease",
                }}
                className="hover:bg-[#f5f5f5]"
              >
                {signingOut ? "Déconnexion…" : "Se déconnecter"}
              </button>
            </div>
          )}
        </div>{/* fin avatarRef */}
        </div>{/* fin groupe droite */}
      </div>{/* fin pill */}
    </header>
  );
}
