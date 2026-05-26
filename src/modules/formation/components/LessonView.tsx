import type { LessonView as LessonViewModel } from "../types";
import type { LessonContent } from "../server/notion";
import { LessonPlayerCard } from "./LessonPlayerCard";
import { LessonNotebook } from "./LessonNotebook";
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
      <LessonBreadcrumb
        formationSlug={formation.slug}
        formationName={formation.name}
        moduleSlug={mod.slug}
        moduleName={mod.name}
        courseName={course.name}
      />

      {/* Player + carnet : groupés serrés pour qu'ils se suivent (collés). */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <LessonPlayerCard
          title={course.name}
          description={course.description}
          videoUrl={content.videoUrl}
          blocks={content.blocks}
          formationName={formation.name}
          moduleName={mod.name}
        />

        <LessonNotebook
          synthese={content.synthese}
          resources={content.resources}
          courseId={course.id}
          initialNote={view.noteContent}
        />
      </div>

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
