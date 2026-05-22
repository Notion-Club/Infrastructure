"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  PartyPopper,
  Play,
  Sparkles,
} from "lucide-react";

import type { Program, UserProgress } from "../types";
import { ProgressBar } from "@/shared/components/dashboard/widgets/ProgressBar";
import { getProgramStats } from "../lib/devOverrides";
import { getAllLessonsOrdered } from "../mocks/formation.mock";

type Props = {
  program: Program;
  progress: UserProgress;
};

export function ProgramCard({ program, progress }: Props) {
  const router = useRouter();
  const stats = getProgramStats(program, progress);
  const allLessons = getAllLessonsOrdered(program);

  const nextLesson = allLessons.find(
    (l) => !progress.completedLessonIds.includes(l.id),
  );
  const completed = stats.percent === 100;
  const notStarted = stats.percent === 0;

  function goToProgram() {
    router.push(`/formation/${program.slug}`);
  }

  function goToResume(e: React.MouseEvent) {
    e.stopPropagation();
    if (!nextLesson) {
      goToProgram();
      return;
    }
    const mod = program.modules.find((m) =>
      m.lessons.some((l) => l.id === nextLesson.id),
    );
    if (!mod) {
      goToProgram();
      return;
    }
    router.push(
      `/formation/${program.slug}/${mod.slug}/${nextLesson.slug}`,
    );
  }

  const nextModule = nextLesson
    ? program.modules.find((m) =>
        m.lessons.some((l) => l.id === nextLesson.id),
      )
    : null;

  return (
    <article
      onClick={goToProgram}
      style={{
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 20,
        padding: 28,
        boxShadow: "var(--nc-shadow-3)",
        cursor: "pointer",
        transition:
          "border-color 350ms cubic-bezier(0.22, 1, 0.36, 1), transform 250ms ease, box-shadow 350ms ease",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        position: "relative",
        overflow: "hidden",
      }}
      className="group hover:border-[rgba(224,98,90,0.32)] hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)]"
    >
      {/* Halo dot pattern au hover, repris du FormationWidget */}
      <div
        aria-hidden
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 220,
          height: 220,
          pointerEvents: "none",
          backgroundImage:
            "radial-gradient(circle, rgba(224,98,90,0.28) 1px, transparent 1.4px)",
          backgroundSize: "11px 11px",
          maskImage:
            "radial-gradient(circle at top right, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(circle at top right, black 0%, transparent 70%)",
        }}
      />

      {completed && (
        <div
          style={{
            position: "relative",
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
          <PartyPopper
            size={18}
            style={{ color: "var(--color-brand)", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Bravo, tu as terminé ce programme.
            </p>
            <p
              style={{
                fontSize: 12,
                color: "var(--color-text-secondary)",
                margin: "2px 0 0 0",
              }}
            >
              Ton certificat sera bientôt téléchargeable depuis cette card.
            </p>
          </div>
        </div>
      )}

      <header
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 6,
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
          {program.requiredCapability === "can_access_paid_programs"
            ? "Programme principal"
            : "Programme gratuit"}
        </span>
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
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {program.description}
        </p>
      </header>

      {!notStarted && (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <ProgressBar percent={stats.percent} />
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
              {stats.completedLessons} / {stats.totalLessons} leçons complétées
            </span>
            <span style={{ fontWeight: 600, color: "var(--color-brand)" }}>
              {stats.percent}%
            </span>
          </div>
        </div>
      )}

      {nextLesson && !completed && !notStarted && (
        <div
          style={{
            position: "relative",
            background: "var(--color-surface-raised)",
            borderRadius: 14,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Sparkles
            size={14}
            style={{ color: "var(--color-brand)", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                margin: 0,
              }}
            >
              Prochaine leçon
            </p>
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
              {nextModule?.name} · {nextLesson.title}
            </p>
          </div>
        </div>
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {completed ? (
          <>
            <button
              type="button"
              onClick={goToProgram}
              style={ctaSecondaryStyle}
            >
              <ArrowRight size={14} />
              Relire le programme
            </button>
            <button
              type="button"
              disabled
              style={{ ...ctaSecondaryStyle, opacity: 0.5, cursor: "not-allowed" }}
              title="Bientôt disponible"
            >
              <CheckCircle2 size={14} />
              Télécharger ton certificat (bientôt)
            </button>
          </>
        ) : notStarted ? (
          <button type="button" onClick={goToResume} style={ctaPrimaryStyle}>
            <Play size={13} fill="currentColor" strokeWidth={0} />
            Commencer
          </button>
        ) : (
          <button type="button" onClick={goToResume} style={ctaPrimaryStyle}>
            <Play size={13} fill="currentColor" strokeWidth={0} />
            Reprendre où j&apos;en étais
          </button>
        )}
      </div>
    </article>
  );
}

const ctaPrimaryStyle: React.CSSProperties = {
  background: "var(--color-brand)",
  color: "white",
  borderRadius: 9999,
  padding: "10px 18px",
  fontSize: 13,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  border: "none",
  cursor: "pointer",
  transition: "transform 200ms ease, box-shadow 200ms ease",
};

const ctaSecondaryStyle: React.CSSProperties = {
  background: "white",
  color: "var(--color-text-primary)",
  border: "1px solid var(--color-border-default)",
  borderRadius: 9999,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  cursor: "pointer",
  transition: "background 200ms ease, border-color 200ms ease",
};
