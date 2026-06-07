"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Lock,
  Play,
  Sparkles,
} from "lucide-react";

import type { CourseRow, ModuleWithCourses } from "../types";
import { startLessonTransition } from "./LessonTransition";

type Props = {
  programSlug: string;
  module: ModuleWithCourses;
  defaultOpen?: boolean;
  // Deep-link depuis le fil d'Ariane d'une leçon : le module démarre fermé
  // puis se déplie tout seul (et scroll dans le viewport) au montage.
  animateOpen?: boolean;
};

export function ModuleAccordion({
  programSlug,
  module,
  defaultOpen = false,
  animateOpen = false,
}: Props) {
  // animateOpen → on part fermé pour rejouer l'animation de dépliage au montage.
  const [open, setOpen] = useState(defaultOpen && !animateOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [innerHeight, setInnerHeight] = useState(0);

  // Mesure la hauteur réelle du contenu pour animer max-height en douceur.
  useEffect(() => {
    if (!innerRef.current) return;
    const el = innerRef.current;
    const update = () => setInnerHeight(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Dépliage auto + scroll quand on arrive via le fil d'Ariane.
  useEffect(() => {
    if (!animateOpen) return;
    const t = setTimeout(() => {
      setOpen(true);
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 280);
    return () => clearTimeout(t);
  }, [animateOpen]);

  const percent =
    module.totalCount === 0
      ? 0
      : Math.round((module.completedCount / module.totalCount) * 100);
  const moduleComplete = percent === 100 && module.totalCount > 0;

  return (
    <div
      ref={rootRef}
      data-fb-label={`Accordéon module « ${module.name} » · Page programme`}
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: open ? "var(--nc-shadow-3)" : "none",
        transition: "box-shadow 250ms ease",
        scrollMarginTop: 120,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-fb-label={`En-tête accordéon module « ${module.name} » · Accordéon module`}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
              }}
            >
              Module {module.position}
            </span>
            {moduleComplete && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--color-brand)" }}>
                <CheckCircle2 size={12} /> Terminé
              </span>
            )}
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text-primary)", margin: "4px 0 0 0", lineHeight: 1.35 }}>
            {module.name}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <div style={{ flex: "0 0 120px", height: 4, background: "var(--color-border-default)", borderRadius: 9999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${percent}%`,
                  background: "var(--color-brand)",
                  borderRadius: 9999,
                  transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {module.completedCount} / {module.totalCount} leçons
            </span>
          </div>
        </div>
        <ChevronDown
          size={18}
          style={{
            color: "var(--color-text-muted)",
            flexShrink: 0,
            transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {/* Collapsible — toujours monté, animé via max-height (pas de saccade) */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? innerHeight : 0,
          opacity: open ? 1 : 0,
          transition:
            "max-height 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease",
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        <div
          ref={innerRef}
          style={{
            padding: "4px 12px 16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            borderTop: "1px solid var(--color-border-default)",
          }}
        >
          {module.courses.map((course) => (
            <LessonRow
              key={course.id}
              programSlug={programSlug}
              moduleSlug={module.slug}
              course={course}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LessonRow({
  programSlug,
  moduleSlug,
  course,
}: {
  programSlug: string;
  moduleSlug: string;
  course: CourseRow;
}) {
  const router = useRouter();

  function onClick() {
    if (course.locked) {
      toast("Termine la leçon précédente pour débloquer", { icon: <Lock size={14} /> });
      return;
    }
    startLessonTransition();
    router.push(`/formation/${programSlug}/${moduleSlug}/${course.slug}`);
  }

  const StatusIcon = course.locked
    ? Lock
    : course.completed
      ? CheckCircle2
      : course.isNext
        ? Play
        : Circle;

  const highlight = course.isNext && !course.locked && !course.completed;

  return (
    <button
      type="button"
      onClick={onClick}
      data-fb-label={`Lien leçon « ${course.name} » · Accordéon module`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        background: highlight ? "rgba(224,98,90,0.06)" : "transparent",
        border: "1px solid",
        borderColor: highlight ? "rgba(224,98,90,0.25)" : "transparent",
        borderRadius: 14,
        cursor: course.locked ? "not-allowed" : "pointer",
        opacity: course.locked ? 0.55 : 1,
        textAlign: "left",
        width: "100%",
        transition: "background 200ms ease, border-color 200ms ease",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: course.completed
            ? "rgba(224,98,90,0.12)"
            : highlight
              ? "var(--color-brand)"
              : "var(--color-surface-raised)",
          color: course.completed
            ? "var(--color-brand)"
            : highlight
              ? "white"
              : "var(--color-text-muted)",
        }}
      >
        <StatusIcon size={14} strokeWidth={2.2} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: course.completed ? 400 : 500,
              color: course.completed ? "var(--color-text-muted)" : "var(--color-text-primary)",
              margin: 0,
              textDecoration: course.completed ? "line-through" : "none",
              lineHeight: 1.35,
            }}
          >
            {course.name}
          </p>
          {highlight && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-brand)", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Sparkles size={10} /> À suivre
            </span>
          )}
        </div>
        {course.description && (
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {course.description}
          </p>
        )}
      </div>
    </button>
  );
}
