import type { LessonView as LessonViewModel } from "../types";
import type { LessonContent } from "../server/notion";
import { LessonPlayerCard } from "./LessonPlayerCard";
import { LessonNavigation } from "./LessonNavigation";
import { LessonReady } from "./LessonTransition";
import { LessonBreadcrumb } from "./LessonBreadcrumb";

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
      <nav aria-label="Fil d'ariane" style={{ display: "flex" }}>
        <LessonBreadcrumb
          formation={formation}
          currentModuleSlug={mod.slug}
          currentCourseSlug={course.slug}
          courseName={course.name}
          tree={view.tree}
        />
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
