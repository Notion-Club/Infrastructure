"use client";

import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { ProgressBar } from "./ProgressBar";

const MOCK_FORMATION = {
  moduleTitle: "Module 6 — Bases de données avancées",
  videoIndex: 3,
  videoTotal: 5,
  progressPercent: 58,
  modulesCompleted: 5,
  modulesTotal: 12,
  resumeUrl: "/formation/module-6/video-3",
  formationUrl: "/formation",
};

export function FormationWidget() {
  const router = useRouter();

  return (
    <article
      onClick={() => router.push(MOCK_FORMATION.formationUrl)}
      style={{
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "var(--nc-shadow-3)",
        cursor: "pointer",
        transition: "border-color 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "relative",
        overflow: "hidden",
      }}
      className="group hover:border-[rgba(224,98,90,0.32)]"
    >
      <div
        aria-hidden
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 180,
          height: 180,
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
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}
      >
        Formation en cours
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {MOCK_FORMATION.moduleTitle}
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>
          Tu t&apos;es arrêté à la vidéo {MOCK_FORMATION.videoIndex} /{" "}
          {MOCK_FORMATION.videoTotal}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <ProgressBar percent={MOCK_FORMATION.progressPercent} />
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
          {MOCK_FORMATION.modulesCompleted} modules complétés ·{" "}
          {MOCK_FORMATION.modulesTotal - MOCK_FORMATION.modulesCompleted} restants
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(MOCK_FORMATION.resumeUrl);
          }}
          style={{
            background: "var(--color-brand)",
            color: "white",
            borderRadius: 9999,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            cursor: "pointer",
            transition: "transform 200ms ease, box-shadow 200ms ease",
          }}
          className="hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_rgba(224,98,90,0.4)]"
        >
          <Play size={13} fill="currentColor" strokeWidth={0} />
          Reprendre
        </button>
      </div>
    </article>
  );
}
