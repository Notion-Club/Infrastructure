"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

import { useDevToolboxClose } from "@/shared/components/dev/DevToolbox";

// Carte DevToolbox réservée aux administrateurs : raccourci vers la page de
// gestion des membres (/membres). Même langage visuel que le déclencheur
// compact d'AdminPushDevCard (icône + label sur fond surface-raised).
//
// La page elle-même re-garde l'accès (redirect /dashboard si non-admin) ; ce
// bouton n'est de toute façon monté que pour les admins (cf. AdminPushRegistrar).

export function MembresAdminDevCard() {
  const router = useRouter();
  const closeToolbox = useDevToolboxClose();

  function open() {
    closeToolbox();
    router.push("/membres");
  }

  return (
    <div data-fb-label="Outils admin · Membres">
      <button
        type="button"
        onClick={open}
        data-fb-label="Ouvrir la gestion des membres"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "12px 8px",
          borderRadius: 12,
          border: "1px solid var(--color-border-default)",
          background: "var(--color-surface-raised)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
          transition: "background 150ms ease, border-color 150ms ease",
        }}
        className="hover:border-[rgba(224,98,90,0.35)] hover:bg-[rgba(224,98,90,0.06)]"
      >
        <span style={{ color: "var(--color-brand)", display: "inline-flex" }}>
          <Users size={18} strokeWidth={1.8} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>Membres</span>
      </button>
    </div>
  );
}
