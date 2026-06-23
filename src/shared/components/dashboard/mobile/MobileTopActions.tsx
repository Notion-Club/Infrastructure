"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, CircleUserRound } from "lucide-react";

import { AppearanceSection } from "@/shared/components/settings/AppearanceSection";
import { MorphMenu } from "@/shared/components/MorphMenu";
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
  const [signingOut, startSignOut] = useTransition();
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

  return (
    <div
      style={{
        // `position: absolute` (et non fixed) : les boutons restent ancrés en
        // HAUT DE PAGE et défilent avec le contenu — ils ne suivent plus le
        // scroll et ne survolent jamais le contenu scrollé.
        position: "absolute",
        // `safe-area-inset-top` vaut ~44px en PWA standalone (status bar
        // iOS transparente grâce à `black-translucent`). Sans cet offset,
        // les boutons se retrouveraient sous l'heure iPhone.
        top: "calc(12px + env(safe-area-inset-top, 0px))",
        right: 12,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* Toolbox « état dev » — visible seulement si la page a enregistré un
          panneau d'options dev. */}
      <DevToolboxButton size={38} floating />

      {/* Notifications — données réelles via useNotifications */}
      <NotificationPopover buttonClassName="nc-mobile-action-btn" variant="mobile" />

      {/* Avatar + dropdown morph */}
      <MorphMenu
        origin="top-right"
        zIndex={60}
        ariaLabel="Menu compte"
        triggerFbLabel="Avatar compte · Barre de navigation"
        panelFbLabel="Menu compte · Barre de navigation"
        triggerStyle={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: avatarUrl ? "transparent" : avatarColor,
          color: "white",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.02em",
          overflow: "hidden",
          padding: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        }}
        triggerContent={
          avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials
          )
        }
      >
        {(close) => (
          <div style={{ padding: 6 }}>
            <AppearanceSection />
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
                close();
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
              <CircleUserRound size={16} style={{ color: "var(--color-text-muted)" }} />
              Profil
            </button>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => close()}
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
      </MorphMenu>
    </div>
  );
}
