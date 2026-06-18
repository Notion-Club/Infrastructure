"use client";

import { ChevronRight } from "lucide-react";

import {
  computeIdentityInitials,
  useProfileIdentityContext,
} from "@/shared/components/identity/ProfileIdentityProvider";
import { useProfileModal } from "@/shared/components/profile/ProfileModalProvider";
import { DEFAULT_AVATAR_COLOR } from "@/modules/settings";

// ============================================================================
// ProfileRecapCard (#128) — rappel compact du profil public dans /settings.
//
// Lit l'identité via le contexte partagé (live : se met à jour dès qu'on
// enregistre dans l'éditeur). Le bouton ouvre l'éditeur de profil — modale
// centrée sur desktop, pleine page sur mobile.
// ============================================================================

export function ProfileRecapCard() {
  const { identity } = useProfileIdentityContext();
  const { open } = useProfileModal();

  const initials = computeIdentityInitials(identity);
  const avatarUrl = identity?.avatarUrl ?? null;
  const avatarColor = identity?.avatarColor ?? DEFAULT_AVATAR_COLOR;
  const displayName =
    identity?.displayName?.trim() ||
    [identity?.firstName, identity?.lastName].filter(Boolean).join(" ").trim() ||
    "Ton profil";
  const username = identity?.username?.trim();

  return (
    <button
      type="button"
      onClick={open}
      data-fb-label="Carte profil public · Réglages"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        padding: 16,
        borderRadius: 20,
        border: "1px solid var(--color-border-default)",
        background: "var(--color-surface-card)",
        boxShadow: "var(--nc-shadow-3)",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: avatarUrl ? "transparent" : avatarColor,
          color: "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.02em",
          overflow: "hidden",
          flexShrink: 0,
        }}
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
      </span>

      <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayName}
        </span>
        <span
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {username ? `@${username} · Profil public` : "Modifier mon profil public"}
        </span>
      </span>

      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          flexShrink: 0,
        }}
      >
        <ChevronRight size={20} />
      </span>
    </button>
  );
}
