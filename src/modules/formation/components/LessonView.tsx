import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { LessonView as LessonViewModel } from "../types";
import type { LessonContent } from "../server/notion";
import { LessonPlayerCard } from "./LessonPlayerCard";
import { LessonResources } from "./LessonResources";
import { LessonNavigation } from "./LessonNavigation";

// Page leçon — colonne unique centrée (alignée sur la nav), vidéo large.
// Plus de colonne notes à droite : les notes vivent dans la carte player
// (onglet « Mes notes »). Plus d'eyebrow module au-dessus du titre : le fil
// d'Ariane porte déjà cette info.
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
        <span>{mod.name}</span>
        <ChevronRight size={11} />
        <span style={{ color: "var(--color-text-primary)" }}>{course.name}</span>
      </nav>

      <LessonPlayerCard
        title={course.name}
        description={course.description}
        videoUrl={content.videoUrl}
        synthese={content.synthese}
        courseId={course.id}
        initialNote={view.noteContent}
      />

      <LessonResources items={content.resources} />

      <LessonNavigation
        programSlug={formation.slug}
        moduleName={mod.name}
        courseId={course.id}
        completed={view.completed}
        prev={view.prev}
        next={view.next}
      />
    </div>
  );
}
