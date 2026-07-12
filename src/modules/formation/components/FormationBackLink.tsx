"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowReturn } from "@/shared/components/icons";

export function FormationBackLink() {
  const router = useRouter();

  // OPS-80 — la page programme est un Server Component qui fetch Notion/Supabase ;
  // sans warm-up, le retour vers /formation était lent. On préfetch la route dès
  // que le bouton est monté (et au survol) pour rendre le retour quasi-instantané.
  useEffect(() => {
    router.prefetch("/formation");
  }, [router]);

  // Retour vers la liste des programmes : plus de voile de transition leçon
  // (barre de progression + skeleton générique). La route /formation étant
  // préfetchée / déjà en cache, le retour est quasi-instantané ; sinon Next
  // affiche le skeleton de contenu de la route (loading.tsx).
  function go() {
    router.push("/formation");
  }

  // Pill « retour » canonique (dimensions identiques au bouton retour de la
  // communauté / ResourceBreadcrumb) : fond blanc surface-card + bordure, pour
  // une cohérence visuelle inter-sections (OPS-84).
  return (
    <button
      type="button"
      onClick={go}
      onMouseEnter={() => router.prefetch("/formation")}
      data-fb-label="Lien retour Tous les programmes · Page programme"
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px 7px 11px",
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        width: "fit-content",
        transition: "all var(--nc-duration-xfast) var(--nc-ease)",
      }}
      className="hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
    >
      <ArrowReturn size={14} /> Tous les programmes
    </button>
  );
}
