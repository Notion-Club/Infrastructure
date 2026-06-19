"use client";

import { useMemo } from "react";

import { useProfileIdentityContext } from "@/shared/components/identity/ProfileIdentityProvider";
import { useRegisterAdminTools } from "@/shared/components/dev/DevToolbox";
import { AdminPushDevCard } from "./AdminPushDevCard";
import { MembresAdminDevCard } from "./MembresAdminDevCard";

// Monté à la racine de (app)/layout.tsx : enregistre les outils admin globaux
// dans le DevToolbox de la topbar UNIQUEMENT si le caller a role='admin'.
//   • Membres   — raccourci vers la page de gestion des membres (/membres).
//   • Notif push — composer d'envoi de Web Push.
// Pour un member/mentor, le hook reçoit `null` et la zone n'apparaît pas.

export function AdminPushRegistrar() {
  const { identity } = useProfileIdentityContext();
  const isAdmin = identity?.role === "admin";

  // useMemo pour stabiliser la référence du node passé au hook — évite que
  // l'effet du DevToolbox re-register à chaque render parent.
  const node = useMemo(
    () =>
      isAdmin ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MembresAdminDevCard />
          <AdminPushDevCard />
        </div>
      ) : null,
    [isAdmin],
  );

  useRegisterAdminTools(node);
  return null;
}
