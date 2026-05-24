"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

import type { LessonNeighbour } from "../types";
import { markCourseCompleted } from "../server/actions";

type Props = {
  programSlug: string;
  moduleName: string;
  courseId: string;
  completed: boolean;
  prev: LessonNeighbour | null;
  next: LessonNeighbour | null;
};

export function LessonNavigation({
  programSlug,
  moduleName,
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
    router.push(`/formation/${programSlug}/${n.moduleSlug}/${n.courseSlug}`);
  }

  function handleMain() {
    startTransition(async () => {
      if (!done) {
        await markCourseCompleted(courseId);
        setDone(true);
      }
      if (next) {
        navTo(next);
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
              background: "white",
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
