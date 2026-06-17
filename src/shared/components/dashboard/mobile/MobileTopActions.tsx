"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, UserRound } from "lucide-react";

import { ThemeToggle } from "@/shared/components/theme/ThemeToggle";
import { NotificationPopover } from "@/modules/community/components/notifications/NotificationPopover";
import { useProfileModal } from "@/shared/components/profile/ProfileModalProvider";
import {
  computeIdentityInitials,
  useProfileIdentityContext,
} from "@/shared/components/identity/ProfileIdentityProvider";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { DevToolboxButton } from "@/shared/components/dev/DevToolbox";

export function MobileTopActions() {
  const router = useRouter();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const avatarRef = useRef<HTMLDivElement>(null);
  const { open: openProfileModal } = useProfileModal();
  const { identity } = useProfileIdentityContext();
  const initials = computeIdentityInitials(identity);
  const avatarUrl = identity?.avatarUrl ?? null;
  const avatarColor = identity?.avatarColor ?? "#e0625a";

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

  return (
    <div
      style={{
        position: "fixed",
        // `safe-area-inset-top` vaut ~44px en PWA standalone (status bar
        // iOS transparente grâce à `black-translucent`). Sans cet offset,
        // les boutons se retrouveraient sous l'heure iPhone.
        top: "calc(12px + env(safe-area-inset-top))",
        right: 12,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 8,
        // Force GPU layer so position:fixed isn't broken by ancestor filters.
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      {/* Toolbox « état dev » — visible seulement si la page a enregistré un
          panneau d'options dev. */}
      <DevToolboxButton size={38} floating />

      {/* Notifications — données réelles via useNotifications */}
      <NotificationPopover buttonClassName="nc-mobile-action-btn" variant="mobile" />

      {/* Avatar + dropdown */}
      <div ref={avatarRef} style={{ position: "relative" }}>
        <button
          type="button"
          aria-label="Menu compte"
          onClick={() => setAvatarOpen((o) => !o)}
          data-fb-label="Avatar compte · Barre de navigation"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: avatarUrl ? "transparent" : avatarColor,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            overflow: "hidden",
            padding: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
          }}
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
            data-fb-label="Menu compte · Barre de navigation"
            className="nc-dropdown-panel"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
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
            <div
              style={{
                height: 1,
                background: "var(--color-border-default)",
                margin: "4px 0",
              }}
            />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAvatarOpen(false);
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
              onClick={() => setAvatarOpen(false)}
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
      </div>
    </div>
  );
}
