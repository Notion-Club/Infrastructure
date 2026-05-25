import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { LessonView as LessonViewModel } from "../types";
import type { LessonContent } from "../server/notion";
import { LessonPlayerCard } from "./LessonPlayerCard";
import { LessonNavigation } from "./LessonNavigation";
import { LessonReady } from "./LessonTransition";

// Page leçon — colonne unique centrée (alignée sur la nav). Le player (titre,
// description, vidéo, body) vit dans une carte ; le carnet (notes, synthèse,
// ressources) le suit dans une carte collée juste en dessous.
export function LessonView({
  view,
  content,
}: {
  view: LessonViewModel;
  content: LessonContent;
}) {
  const { formation, module: mod, course } = view;

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
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
        <Link href="/formation" style={{ color: "inherit", textDecoration: "none" }}>
          Formation
        </Link>
        <ChevronRight size={11} />
        <Link href={`/formation/${formation.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
          {formation.name}
        </Link>
        <ChevronRight size={11} />
        <Link
          href={`/formation/${formation.slug}?module=${mod.slug}`}
          style={{ color: "inherit", textDecoration: "none" }}
          className="hover:text-[var(--color-text-primary)] transition-colors"
        >
          {mod.name}
        </Link>
        <ChevronRight size={11} />
        <span style={{ color: "var(--color-text-primary)" }}>{course.name}</span>
      </nav>

      {/* Player + carnet réunis dans un seul bloc (carnet en fin de carte). */}
      <LessonPlayerCard
        title={course.name}
        description={course.description}
        videoUrl={content.videoUrl}
        blocks={content.blocks}
        formationName={formation.name}
        moduleName={mod.name}
        synthese={content.synthese}
        resources={content.resources}
        courseId={course.id}
        noteContent={view.noteContent}
      />

      <LessonNavigation
        programSlug={formation.slug}
        formationName={formation.name}
        moduleName={mod.name}
        courseName={course.name}
        courseId={course.id}
        completed={view.completed}
        prev={view.prev}
        next={view.next}
      />

      {/* Signale au voile de transition que le contenu du cours est rendu. */}
      <LessonReady />
    </div>
  );
}
