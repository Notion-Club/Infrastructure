"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

import type { LessonNeighbour } from "../types";
import { markCourseCompleted } from "../server/actions";
import { startLessonTransition } from "./LessonTransition";

type Props = {
  programSlug: string;
  formationName: string;
  moduleName: string;
  courseName: string;
  courseId: string;
  completed: boolean;
  prev: LessonNeighbour | null;
  next: LessonNeighbour | null;
};

export function LessonNavigation({
  programSlug,
  formationName,
  moduleName,
  courseName,
  courseId,
  completed,
  prev,
  next,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(completed);

  function navTo(n: LessonNeighbour | null) {
    if (!n) return;
    // Voile de transition (sans feedback) : masque l'ancien cours pendant le
    // chargement du suivant, puis révèle.
    startLessonTransition();
    window.scrollTo({ top: 0, behavior: "instant" });
    router.push(`/formation/${programSlug}/${n.moduleSlug}/${n.courseSlug}`);
  }

  function handleMain() {
    // Vers une leçon suivante : on arme le voile de transition AVANT le push.
    // À la première complétion, il héberge le feedback du cours qu'on quitte
    // (le voile fait le pont pendant le chargement, puis révèle le nouveau cours).
    if (next) {
      startLessonTransition({
        feedback: done ? undefined : { courseName, formationName, moduleName },
      });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    startTransition(async () => {
      if (!done) {
        await markCourseCompleted(courseId);
        setDone(true);
      }
      if (next) {
        router.push(`/formation/${programSlug}/${next.moduleSlug}/${next.courseSlug}`);
      } else {
        router.push(`/formation/${programSlug}`);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "20px 0 4px 0" }}>
      {done && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--color-brand)", alignSelf: "flex-end" }}>
          <CheckCircle2 size={13} /> Leçon complétée
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        {prev ? (
          <button
            type="button"
            onClick={() => navTo(prev)}
            style={{
              background: "var(--color-surface-card)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 9999,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              cursor: "pointer",
            }}
            className="hover:bg-[var(--color-surface-raised)]"
          >
            <ArrowLeft size={14} /> Leçon précédente
          </button>
        ) : (
          <span aria-hidden />
        )}

        <button
          type="button"
          onClick={handleMain}
          disabled={pending}
          style={{
            background: "var(--color-brand)",
            color: "white",
            border: "none",
            borderRadius: 9999,
            padding: "11px 22px",
            fontSize: 14,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.7 : 1,
            boxShadow: "0 8px 24px -8px rgba(224,98,90,0.5)",
          }}
        >
          {done ? (next ? "Leçon suivante" : "Retour au programme") : "J'ai terminé"}
          <ArrowRight size={14} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push(`/formation/${programSlug}`)}
        style={{
          alignSelf: "center",
          background: "transparent",
          color: "var(--color-text-muted)",
          border: "none",
          fontSize: 12,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3,
          marginTop: 4,
        }}
      >
        Retour au module · {moduleName}
      </button>
    </div>
  );
}
