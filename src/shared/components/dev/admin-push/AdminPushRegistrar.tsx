"use client";

import { useMemo } from "react";

import { useProfileIdentityContext } from "@/shared/components/identity/ProfileIdentityProvider";
import { useRegisterAdminTools } from "@/shared/components/dev/DevToolbox";
import { AdminPushDevCard } from "./AdminPushDevCard";

// Monté à la racine de (app)/layout.tsx : enregistre la carte « Notif push »
// dans le DevToolbox de la topbar UNIQUEMENT si le caller a role='admin'.
// Pour un member/mentor, le hook reçoit `null` et la zone n'apparaît pas.

export function AdminPushRegistrar() {
  const { identity } = useProfileIdentityContext();
  const isAdmin = identity?.role === "admin";

  // useMemo pour stabiliser la référence du node passé au hook — évite que
  // l'effet du DevToolbox re-register à chaque render parent.
  const node = useMemo(
    () => (isAdmin ? <AdminPushDevCard /> : null),
    [isAdmin],
  );

  useRegisterAdminTools(node);
  return null;
}
