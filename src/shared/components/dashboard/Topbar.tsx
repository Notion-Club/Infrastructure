"use client";

import { useRef, useEffect, useLayoutEffect, useCallback, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  BookOpen,
  Users,
  Calendar,
  Library,
  UserRound,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { AppearanceSection } from "@/shared/components/settings/AppearanceSection";
import { NotificationPopover } from "@/modules/community/components/notifications/NotificationPopover";
import { useProfileModal } from "@/shared/components/profile/ProfileModalProvider";
import { useTheme } from "@/shared/lib/hooks/useTheme";
import {
  computeIdentityInitials,
  useProfileIdentityContext,
} from "@/shared/components/identity/ProfileIdentityProvider";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { DevToolboxButton } from "@/shared/components/dev/DevToolbox";
import { useDropdownTransition } from "@/shared/lib/hooks/useDropdownTransition";

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
  const {
    isOpen: avatarOpen,
    isMounted: avatarMounted,
    stateClass: avatarStateClass,
    close: closeAvatar,
    toggle: toggleAvatar,
  } = useDropdownTransition();
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
        closeAvatar();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [avatarOpen, closeAvatar]);

  const { theme } = useTheme();
  const { open: openProfileModal } = useProfileModal();
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
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
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
        data-fb-label="Barre de navigation"
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
            aria-label="Notion Club, retour à l'accueil"
            data-fb-label="Logo Notion Club · Barre de navigation"
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
                  data-fb-label={`Onglet « ${label} » · Barre de navigation`}
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

        {/* ── Droite : toolbox dev + cloche + avatar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Toolbox « état dev » — visible seulement si la page a enregistré
              un panneau (cf. DevToolboxProvider / useRegisterDevTools). */}
          <DevToolboxButton size={40} />

          {/* Cloche + popover notifications (données réelles via useNotifications) */}
          <NotificationPopover buttonClassName="hover:bg-[rgba(0,0,0,0.04)]" />

          {/* Avatar + dropdown */}
          <div ref={avatarRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label="Menu compte"
            onClick={() => toggleAvatar()}
            data-fb-label="Avatar compte · Barre de navigation"
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

          {avatarMounted && (
            <div
              role="menu"
              data-fb-label="Menu compte · Barre de navigation"
              className={`nc-dropdown-panel t-dropdown ${avatarStateClass}`}
              data-origin="top-right"
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                minWidth: 248,
                borderRadius: 16,
                overflow: "hidden",
                zIndex: 60,
                padding: 6,
              }}
            >
              <AppearanceSection />
              <div style={{ height: 1, background: "var(--color-border-default)", margin: "4px 0" }} />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeAvatar();
                  openProfileModal();
                }}
                data-fb-label="Bouton « Profil » · Menu compte"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px",
                  fontSize: 14,
                  color: "var(--color-text-primary)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 10,
                  transition: "background 150ms ease",
                }}
                className="hover:bg-[var(--color-surface-raised)]"
              >
                <UserRound size={16} style={{ color: "var(--color-text-muted)" }} />
                Profil
              </button>
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => closeAvatar()}
                data-fb-label="Lien « Réglages » · Menu compte"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 10px",
                  fontSize: 14,
                  color: "var(--color-text-primary)",
                  textDecoration: "none",
                  borderRadius: 10,
                  transition: "background 150ms ease",
                }}
                className="hover:bg-[var(--color-surface-raised)]"
              >
                <Settings size={16} style={{ color: "var(--color-text-muted)" }} />
                Réglages
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
                data-fb-label="Bouton « Se déconnecter » · Menu compte"
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
