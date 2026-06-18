"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { startLessonTransition } from "./LessonTransition";

export function FormationBackLink() {
  const router = useRouter();

  // OPS-80 — la page programme est un Server Component qui fetch Notion/Supabase ;
  // sans warm-up, le retour vers /formation était lent. On préfetch la route dès
  // que le bouton est monté (et au survol) pour rendre le retour quasi-instantané.
  useEffect(() => {
    router.prefetch("/formation");
  }, [router]);

  function go() {
    startLessonTransition();
    router.push("/formation");
  }

  // DA alignée sur le bouton retour des Ressources (ResourceBreadcrumb) :
  // pill `surface-raised` + bordure, pour une cohérence visuelle inter-sections
  // (OPS-84).
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
        padding: "6px 12px 6px 10px",
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        width: "fit-content",
        transition: "all 150ms ease",
      }}
      className="hover:bg-[#eaeaea] hover:text-[var(--color-text-primary)]"
    >
      <ArrowLeft size={13} strokeWidth={2.25} /> Tous les programmes
    </button>
  );
}
