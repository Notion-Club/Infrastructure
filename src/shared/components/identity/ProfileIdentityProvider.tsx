"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Identity rendue côté serveur dans (app)/layout.tsx puis injectée via
// ce Provider. Les composants connectés (Topbar, MobileTopActions, etc.)
// lisent via useContext(ProfileIdentityContext) au lieu de fetcher.
//
// Quand l'user modifie son profil dans /settings (changement de nom,
// avatar, couleur), `updateIdentity` permet de mettre à jour le context
// pour que la Topbar reflète le changement sans full reload.

export type ProfileIdentity = {
  id: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  // Rôle plateforme (cf. migration 013). NULL si pas auth.
  role: "member" | "mentor" | "admin" | null;
  // Offer dérivée via user_has_capability('can_view_paid_content').
  // Utilisée par module community (visibility-rules, dm-rules, restrictions
  // d'écriture pour free users).
  offer: "free" | "paid" | null;
};

type ProfileIdentityContextValue = {
  identity: ProfileIdentity | null;
  updateIdentity: (patch: Partial<ProfileIdentity>) => void;
};

const ProfileIdentityContext =
  createContext<ProfileIdentityContextValue | null>(null);

export function ProfileIdentityProvider({
  initialIdentity,
  children,
}: {
  initialIdentity: ProfileIdentity | null;
  children: ReactNode;
}) {
  const [identity, setIdentity] = useState<ProfileIdentity | null>(
    initialIdentity,
  );

  const updateIdentity = useCallback((patch: Partial<ProfileIdentity>) => {
    setIdentity((prev) => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
  }, []);

  const value = useMemo<ProfileIdentityContextValue>(
    () => ({ identity, updateIdentity }),
    [identity, updateIdentity],
  );

  return (
    <ProfileIdentityContext.Provider value={value}>
      {children}
    </ProfileIdentityContext.Provider>
  );
}

// Hook tolérant : renvoie { identity: null, updateIdentity: noop } si pas
// de Provider parent (par ex. composant rendu hors de (app)/). Évite les
// crashs côté login/signup.
export function useProfileIdentityContext(): ProfileIdentityContextValue {
  const ctx = useContext(ProfileIdentityContext);
  if (!ctx) {
    return { identity: null, updateIdentity: () => {} };
  }
  return ctx;
}

// Helper : initiales depuis l'identity (cascade idiomatique).
export function computeIdentityInitials(
  identity: ProfileIdentity | null,
): string {
  if (!identity) return "?";
  const fn = identity.firstName?.trim();
  const ln = identity.lastName?.trim();
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (ln) return ln.slice(0, 2).toUpperCase();
  const display = identity.displayName?.trim();
  if (display) {
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  const local = identity.email?.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "?";
}
