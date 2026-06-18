"use client";

import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

import { startLessonTransition } from "./LessonTransition";

// #102 — bouton « Reprendre » sur la page programme : envoie directement vers
// la prochaine leçon à suivre (course.isNext), avec la même transition animée
// que les lignes de leçon de l'accordéon (startLessonTransition + push).
export function ResumeLessonButton({ href }: { href: string }) {
  const router = useRouter();

  function onClick() {
    startLessonTransition();
    router.push(href);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-fb-label="Bouton Reprendre · Page programme"
      style={{
        alignSelf: "flex-start",
        marginTop: 4,
        background: "var(--color-brand)",
        color: "white",
        borderRadius: 9999,
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: "none",
        cursor: "pointer",
        boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
        transition: "transform 200ms ease, box-shadow 200ms ease",
      }}
      className="hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-6px_rgba(224,98,90,0.5)]"
    >
      <Play size={14} fill="currentColor" strokeWidth={0} />
      Reprendre la formation
    </button>
  );
}
