"use client";

import { useMemo } from "react";
import { useProfileIdentityContext } from "@/shared/components/identity/ProfileIdentityProvider";
import type { User } from "../types/user.types";

// ============================================================================
// useCurrentUser — branché sur ProfileIdentityContext (server-rendered)
// ============================================================================
// Lit le viewer depuis le context hydraté dans (app)/layout.tsx. Le module
// community consomme ce User pour les visibility-rules, dm-rules, affichage
// du composer, etc.
//
// Le paramètre `_devRole` est ignoré (signature legacy compatibilité avec
// les call sites existants : community-page, PostCard, UserHoverCard, etc.).
// Le DevRoleToggle visible en bas en dev ne pilote plus le viewer — il sert
// uniquement à tester les feedStates (loading/empty/error).
export function useCurrentUser(_devRole?: unknown): User {
  const { identity } = useProfileIdentityContext();

  return useMemo(() => {
    if (!identity || !identity.id) {
      return {
        id: "anonymous",
        name: "Invité",
        username: null,
        avatarUrl: null,
        avatarColor: null,
        initials: "?",
        role: "member",
        offer: "free",
        joinedAt: new Date().toISOString(),
      };
    }

    const firstName = identity.firstName?.trim();
    const lastName = identity.lastName?.trim();
    const display = identity.displayName?.trim();
    const username = identity.username?.trim();

    let name: string;
    if (firstName && lastName) name = `${firstName} ${lastName}`;
    else if (firstName) name = firstName;
    else if (display) name = display;
    else if (username) name = username;
    else name = identity.email?.split("@")[0] ?? "Utilisateur";

    let initials: string;
    if (firstName && lastName) initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
    else if (firstName) initials = firstName.slice(0, 2).toUpperCase();
    else if (display) {
      const parts = display.split(/\s+/).filter(Boolean);
      initials =
        parts.length >= 2
          ? `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
          : parts[0]!.slice(0, 2).toUpperCase();
    } else initials = (username ?? identity.email ?? "?").slice(0, 2).toUpperCase();

    return {
      id: identity.id,
      name,
      username: username ?? null,
      avatarUrl: identity.avatarUrl,
      avatarColor: identity.avatarColor,
      initials,
      role: identity.role ?? "member",
      offer: identity.offer ?? "free",
      joinedAt: new Date().toISOString(),
    };
  }, [identity]);
}
