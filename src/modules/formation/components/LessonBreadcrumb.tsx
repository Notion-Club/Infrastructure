"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { startLessonTransition } from "./LessonTransition";

type Props = {
  formationSlug: string;
  formationName: string;
  moduleSlug: string;
  moduleName: string;
  courseName: string;
};

const linkStyle: React.CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  cursor: "pointer",
};

export function LessonBreadcrumb({
  formationSlug,
  formationName,
  moduleSlug,
  moduleName,
  courseName,
}: Props) {
  const router = useRouter();

  function go(href: string) {
    startLessonTransition();
    router.push(href);
  }

  return (
    <nav
      aria-label="Fil d'ariane"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        fontSize: 12,
        color: "var(--color-text-muted)",
      }}
    >
      <button onClick={() => go("/formation")} style={linkStyle}>
        Formation
      </button>
      <ChevronRight size={11} />
      <button onClick={() => go(`/formation/${formationSlug}`)} style={linkStyle}>
        {formationName}
      </button>
      <ChevronRight size={11} />
      <button
        onClick={() => go(`/formation/${formationSlug}?module=${moduleSlug}`)}
        style={linkStyle}
        className="hover:text-[var(--color-text-primary)] transition-colors"
      >
        {moduleName}
      </button>
      <ChevronRight size={11} />
      <span style={{ color: "var(--color-text-primary)" }}>{courseName}</span>
    </nav>
  );
}
