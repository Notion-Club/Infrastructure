"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useTransition } from "react";
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
import { useTheme } from "@/shared/lib/hooks/useTheme";
import {
  computeIdentityInitials,
  useProfileIdentityContext,
} from "@/shared/components/identity/ProfileIdentityProvider";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

type NavItem = { label: string; icon: LucideIcon; href: string };

const LOGO_LIGHT =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777034233/Notion_Club_-_Black_-_Sans_BG_hcvk9k.png";
const LOGO_DARK =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777935553/Notion_Club_-_White_-_Sans_BG_du43oh.png";

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
      background: "var(--color-border-default)",
      flexShrink: 0,
      alignSelf: "center",
    }}
  />
);

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const avatarRef = useRef<HTMLDivElement>(null);

  // Logout via browser client : signOut() côté client invalide la session
  // et purge les cookies, puis on redirige hard pour que le layout (app)/
  // re-évalue auth.getUser() côté serveur et nous renvoie sur /login.
  function handleSignOut() {
    startSignOut(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

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

  const { theme } = useTheme();
  const { identity } = useProfileIdentityContext();
  const initials = computeIdentityInitials(identity);
  const avatarUrl = identity?.avatarUrl ?? null;
  const avatarColor = identity?.avatarColor ?? "#e0625a";

  // Pill glissante — pattern Transitions.dev.
  const itemRefs       = useRef<(HTMLAnchorElement | null)[]>([]);
  const pillRef        = useRef<HTMLDivElement>(null);
  const lastClickedRef = useRef<number>(-1);

  const moveTo = useCallback((idx: number, animate: boolean) => {
    const el   = itemRefs.current[idx];
    const pill = pillRef.current;
    if (!el || !pill) return;

    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
    }
  }, []);

  useLayoutEffect(() => {
    const idx = NAV_ITEMS.findIndex(
      ({ href }) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/")),
    );
    if (lastClickedRef.current === idx) {
      lastClickedRef.current = -1;
      return;
    }
    lastClickedRef.current = -1;
    moveTo(idx, false);
  }, [pathname, moveTo]);

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
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      <div
        className="nc-topbar-pill"
        style={{
          width: "100%",
          maxWidth: 920,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
          borderRadius: 9999,
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
              src={theme === "dark" ? LOGO_DARK : LOGO_LIGHT}
              alt="Notion Club"
              width={120}
              height={40}
              priority
              style={{ height: 32, width: "auto", display: "block", flexShrink: 0 }}
            />
          </Link>

          {SEPARATOR}

          <nav style={{ display: "flex", alignItems: "center", gap: 2, position: "relative" }}>
            {/* Pill glissante — class nc-nav-pill porte la CSS transition. */}
            <div
              ref={pillRef}
              aria-hidden
              className="nc-nav-pill"
              style={{
                position: "absolute",
                left: 0,
                background: "var(--nc-nav-active-bg)",
                borderRadius: 9999,
                pointerEvents: "none",
                willChange: "transform, width",
                zIndex: 0,
              }}
            />

            {NAV_ITEMS.map(({ label, icon: Icon, href }, i) => {
              const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
              return (
                <Link
                  key={href}
                  href={href}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  onClick={() => { lastClickedRef.current = i; moveTo(i, true); }}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 16px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    color: "var(--color-text-primary)",
                    background: "transparent",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                  className={!isActive ? "hover:bg-[var(--nc-nav-hover-bg)]" : ""}
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
              color: "var(--color-text-secondary)",
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
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              initials
            )}
          </button>

          {avatarOpen && (
            <div
              role="menu"
              className="nc-dropdown-panel"
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                minWidth: 220,
                borderRadius: 16,
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
                <span style={{ fontSize: 14, color: "var(--color-text-primary)" }}>
                  Mode sombre
                </span>
                <ThemeToggle />
              </div>
              <div style={{ height: 1, background: "var(--color-border-default)", margin: "4px 0" }} />
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setAvatarOpen(false)}
                style={{
                  display: "block",
                  padding: "10px 10px",
                  fontSize: 14,
                  color: "var(--color-text-primary)",
                  textDecoration: "none",
                  borderRadius: 10,
                  transition: "background 150ms ease",
                }}
                className="hover:bg-[var(--color-surface-raised)]"
              >
                Réglages
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-brand)",
                  background: "transparent",
                  border: "none",
                  cursor: signingOut ? "wait" : "pointer",
                  opacity: signingOut ? 0.6 : 1,
                  borderRadius: 10,
                  transition: "background 150ms ease",
                }}
                className="hover:bg-[var(--color-surface-raised)]"
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
