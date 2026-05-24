"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

import type { FormationModule, Lesson, Program } from "../types";
import { useFormationContext } from "../hooks/useFormationMocks";

type Props = {
  program: Program;
  module: FormationModule;
  lesson: Lesson;
};

type Neighbour = {
  module: FormationModule;
  lesson: Lesson;
} | null;

function findNeighbours(
  program: Program,
  lesson: Lesson,
): { prev: Neighbour; next: Neighbour } {
  const flat = program.modules
    .slice()
    .sort((a, b) => a.position - b.position)
    .flatMap((m) =>
      m.lessons
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((l) => ({ module: m, lesson: l })),
    );

  const idx = flat.findIndex((x) => x.lesson.id === lesson.id);
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

export function LessonNavigation({ program, module, lesson }: Props) {
  const router = useRouter();
  const { progress, markCompleted, setLastAccessed } = useFormationContext();
  const completed = progress.completedLessonIds.includes(lesson.id);

  const { prev, next } = findNeighbours(program, lesson);

  function goTo(target: Neighbour) {
    if (!target) return;
    setLastAccessed(target.lesson.id);
    router.push(
      `/formation/${program.slug}/${target.module.slug}/${target.lesson.slug}`,
    );
  }

  function handleMainCta() {
    if (!completed) markCompleted(lesson.id);
    if (next) {
      goTo(next);
    } else {
      router.push(`/formation/${program.slug}`);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "20px 0 4px 0",
      }}
    >
      {completed && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-brand)",
            alignSelf: "flex-end",
          }}
        >
          <CheckCircle2 size={13} />
          Leçon complétée
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {prev ? (
          <button
            type="button"
            onClick={() => goTo(prev)}
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
              transition: "background 200ms ease, border-color 200ms ease",
            }}
            className="hover:bg-[var(--color-surface-raised)]"
          >
            <ArrowLeft size={14} />
            Leçon précédente
          </button>
        ) : (
          <span aria-hidden />
        )}

        <button
          type="button"
          onClick={handleMainCta}
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
            cursor: "pointer",
            boxShadow: "0 8px 24px -8px rgba(224,98,90,0.5)",
            transition: "transform 200ms ease, box-shadow 200ms ease",
          }}
          className="hover:-translate-y-0.5"
        >
          {completed ? "Leçon suivante" : "J'ai terminé"}
          <ArrowRight size={14} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push(`/formation/${program.slug}`)}
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
        className="hover:text-[var(--color-text-secondary)]"
        title={`Retour au programme ${program.name}`}
      >
        Retour au module · {module.name}
      </button>
    </div>
  );
}
