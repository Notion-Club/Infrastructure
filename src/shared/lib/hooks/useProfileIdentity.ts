"use client";

import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

export type ProfileIdentity = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

// Hook partagé par Topbar et MobileTopActions pour afficher les bonnes
// initiales / le bon avatar dans le rond utilisateur en haut à droite.
//
// Fetch client-side (useEffect) — léger flash placeholder → réel au mount,
// acceptable pour un élément de 36-38px. Pas de revalidation : si l'user
// change son avatar dans /settings, la page n'est pas live-rafraîchie
// (un soft refresh suffit, ce qui est OK pour ce scope).
export function useProfileIdentity(): {
  identity: ProfileIdentity | null;
  loading: boolean;
} {
  const [identity, setIdentity] = useState<ProfileIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          if (!cancelled) {
            setIdentity(null);
            setLoading(false);
          }
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle<{
            first_name: string | null;
            last_name: string | null;
            avatar_url: string | null;
          }>();

        if (cancelled) return;
        setIdentity({
          firstName: profile?.first_name ?? null,
          lastName: profile?.last_name ?? null,
          email: user.email ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        });
      } catch {
        if (!cancelled) setIdentity(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { identity, loading };
}

// Helper : calcule des initiales à partir des champs disponibles.
// Cascade :
//   1. first_name[0] + last_name[0]   (cas typique "NG")
//   2. first_name[0..2]               (juste un prénom : "NA")
//   3. email[0..2] avant le @         (fallback ultime)
//   4. "?"
export function computeInitials(identity: ProfileIdentity | null): string {
  if (!identity) return "?";
  const fn = identity.firstName?.trim();
  const ln = identity.lastName?.trim();
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (ln) return ln.slice(0, 2).toUpperCase();
  const email = identity.email?.trim();
  if (email) {
    const local = email.split("@")[0] ?? "";
    return local.slice(0, 2).toUpperCase() || "?";
  }
  return "?";
}
