"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Lock,
  PhoneCall,
  Play,
  Circle,
  Sparkles,
} from "lucide-react";

import type { FormationModule, Lesson, Program } from "../types";
import { useFormationContext } from "../hooks/useFormationMocks";
import {
  canAccessLesson,
  isNextLesson,
  shouldForceLock,
} from "../lib/canAccessLesson";

type Props = {
  program: Program;
  module: FormationModule;
  lesson: Lesson;
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

export function LessonRow({ program, module, lesson }: Props) {
  const router = useRouter();
  const { capabilities, progress, devSpecial } = useFormationContext();
  const forceLocked = shouldForceLock(devSpecial);

  const access = canAccessLesson({
    program,
    module,
    lesson,
    capabilities,
    progress,
    forceLocked,
  });

  const completed = progress.completedLessonIds.includes(lesson.id);
  const isNext = isNextLesson({ program, lesson, progress });
  const isSales = lesson.isSalesLesson;

  function onClick() {
    if (!access.allowed && access.reason === "drip_locked") {
      toast("Termine la leçon précédente pour débloquer", {
        icon: <Lock size={14} />,
      });
      return;
    }
    if (!access.allowed && access.reason === "no_capability") {
      toast.error(
        "Cette leçon est réservée aux membres de Devenir consultant Notion",
      );
      return;
    }
    router.push(`/formation/${program.slug}/${module.slug}/${lesson.slug}`);
  }

  const StatusIcon = !access.allowed
    ? Lock
    : completed
      ? CheckCircle2
      : isSales
        ? PhoneCall
        : isNext
          ? Play
          : Circle;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        background: isNext && access.allowed ? "rgba(224,98,90,0.06)" : "transparent",
        border: "1px solid",
        borderColor:
          isNext && access.allowed
            ? "rgba(224,98,90,0.25)"
            : "transparent",
        borderRadius: 14,
        cursor: !access.allowed ? "not-allowed" : "pointer",
        opacity: !access.allowed ? 0.55 : 1,
        textAlign: "left",
        transition: "background 200ms ease, border-color 200ms ease",
        width: "100%",
      }}
      className={
        access.allowed && !isNext
          ? "hover:bg-[rgba(0,0,0,0.03)]"
          : ""
      }
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: completed
            ? "rgba(224,98,90,0.12)"
            : isNext && access.allowed
              ? "var(--color-brand)"
              : isSales
                ? "rgba(224,98,90,0.12)"
                : "var(--color-surface-raised)",
          color: completed
            ? "var(--color-brand)"
            : isNext && access.allowed
              ? "white"
              : isSales
                ? "var(--color-brand)"
                : "var(--color-text-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <StatusIcon size={14} strokeWidth={2.2} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontWeight: completed ? 400 : 500,
              color: completed
                ? "var(--color-text-muted)"
                : "var(--color-text-primary)",
              margin: 0,
              textDecoration: completed ? "line-through" : "none",
              lineHeight: 1.35,
            }}
          >
            {lesson.title}
          </p>
          {isSales && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--color-brand)",
                background: "rgba(224,98,90,0.1)",
                border: "1px solid rgba(224,98,90,0.22)",
                borderRadius: 9999,
                padding: "2px 8px",
              }}
            >
              Module de vente
            </span>
          )}
          {isNext && access.allowed && !completed && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--color-brand)",
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Sparkles size={10} />À suivre
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            margin: "2px 0 0 0",
          }}
        >
          {formatDuration(lesson.videoDurationSeconds)}
        </p>
      </div>
    </button>
  );
}
