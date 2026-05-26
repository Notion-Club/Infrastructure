"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Play, PartyPopper, Sparkles } from "lucide-react";

import { ProgressBar } from "@/shared/components/dashboard/widgets/ProgressBar";
import type { ProgramSummary } from "../types";
import { startLessonTransition } from "./LessonTransition";

export function ProgramCard({ program }: { program: ProgramSummary }) {
  const router = useRouter();
  const completed = program.percent === 100;
  const notStarted = program.percent === 0;
  const resumeHref = program.resumeHref ?? `/formation/${program.slug}`;
  const detailHref = `/formation/${program.slug}`;

  function go(href: string) {
    startLessonTransition();
    router.push(href);
  }

  return (
    <article
      className="transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 20,
        padding: 28,
        boxShadow: "var(--nc-shadow-3)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Zone cliquable « stretched » : toute la carte ouvre le détail (avec la
          transition). Le CTA (Reprendre/Commencer) reste cliquable au-dessus (z-index). */}
      <button
        type="button"
        aria-label={`Ouvrir la formation ${program.name}`}
        onClick={() => go(detailHref)}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      />
      {completed && (
        <div
          style={{
            background:
              "linear-gradient(110deg, rgba(224,98,90,0.10), rgba(224,98,90,0.04))",
            border: "1px solid rgba(224,98,90,0.25)",
            borderRadius: 14,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <PartyPopper size={18} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
            Bravo, tu as terminé ce programme.
          </p>
        </div>
      )}

      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            lineHeight: 1.2,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {program.name}
        </h2>
        {program.description && (
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
            {program.description}
          </p>
        )}
      </header>

      {!notStarted && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ProgressBar percent={program.percent} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
              color: "var(--color-text-muted)",
            }}
          >
            <span>
              {program.completedCourses} / {program.totalCourses} leçons complétées
            </span>
            <span style={{ fontWeight: 600, color: "var(--color-brand)" }}>{program.percent}%</span>
          </div>
        </div>
      )}

      {program.nextCourseLabel && !completed && (
        <div
          style={{
            background: "var(--color-surface-raised)",
            borderRadius: 14,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Sparkles size={14} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>Prochaine leçon</p>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                margin: "2px 0 0 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {program.nextCourseLabel}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "relative", zIndex: 2 }}>
        <button
          type="button"
          onClick={() => go(resumeHref)}
          style={{
            background: "var(--color-brand)",
            color: "white",
            border: "none",
            borderRadius: 9999,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            cursor: "pointer",
          }}
        >
          {completed ? (
            <>
              <ArrowRight size={14} /> Relire le programme
            </>
          ) : notStarted ? (
            <>
              <Play size={13} fill="currentColor" strokeWidth={0} /> Commencer
            </>
          ) : (
            <>
              <Play size={13} fill="currentColor" strokeWidth={0} /> Reprendre où j&apos;en étais
            </>
          )}
        </button>
      </div>
    </article>
  );
}
