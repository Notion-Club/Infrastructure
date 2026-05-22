"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";

import type { FormationModule, Program } from "../types";
import { useFormationContext } from "../hooks/useFormationMocks";
import { getModuleStats } from "../lib/devOverrides";
import { LessonRow } from "./LessonRow";

type Props = {
  program: Program;
  module: FormationModule;
  defaultOpen?: boolean;
};

export function ModuleAccordion({ program, module, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const { progress } = useFormationContext();
  const stats = getModuleStats(module, progress);
  const completed = stats.percent === 100;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: open ? "var(--nc-shadow-3)" : "none",
        transition: "box-shadow 250ms ease",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
        aria-expanded={open}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
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
            {completed && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-brand)",
                }}
              >
                <CheckCircle2 size={12} />
                Terminé
              </span>
            )}
          </div>
          <h3
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: "4px 0 0 0",
              lineHeight: 1.35,
            }}
          >
            {module.name}
          </h3>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 10,
            }}
          >
            <div
              style={{
                flex: "0 0 120px",
                height: 4,
                background: "var(--color-border-default)",
                borderRadius: 9999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${stats.percent}%`,
                  background: "var(--color-brand)",
                  borderRadius: 9999,
                  transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
              }}
            >
              {stats.completedLessons} / {stats.totalLessons} leçons
            </span>
          </div>
        </div>

        <ChevronDown
          size={18}
          style={{
            color: "var(--color-text-muted)",
            flexShrink: 0,
            transition: "transform 200ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            padding: "4px 12px 16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            borderTop: "1px solid var(--color-border-default)",
          }}
        >
          {module.lessons
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((lesson) => (
              <LessonRow
                key={lesson.id}
                program={program}
                module={module}
                lesson={lesson}
              />
            ))}
        </div>
      )}
    </div>
  );
}
