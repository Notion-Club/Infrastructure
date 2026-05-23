import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { NotionBlock } from "@/shared/lib/notion/blocks";
import type { LessonView as LessonViewModel } from "../types";
import { NotionBlocks } from "./notion/NotionBlocks";
import { LessonNotes } from "./LessonNotes";
import { LessonNavigation } from "./LessonNavigation";

// Page leçon (Server Component). Le body Notion (blocs) est fetché côté
// serveur à l'ouverture (lazy) et passé en props.
export function LessonView({
  view,
  blocks,
}: {
  view: LessonViewModel;
  blocks: NotionBlock[];
}) {
  const { formation, module: mod, course } = view;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <nav
        aria-label="Fil d'ariane"
        style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12, color: "var(--color-text-muted)" }}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Colonne principale */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
              {mod.name}
            </span>
            <h1
              style={{
                fontSize: "clamp(28px, 3.6vw, 38px)",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "var(--color-text-primary)",
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              {course.name}
            </h1>
            {course.description && (
              <p style={{ fontSize: 15, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6 }}>
                {course.description}
              </p>
            )}
          </header>

          {/* Body Notion rendu fidèlement (vidéo Tella, callouts, etc.) */}
          <section>
            <NotionBlocks blocks={blocks} />
          </section>

          <LessonNavigation
            programSlug={formation.slug}
            moduleName={mod.name}
            courseId={course.id}
            completed={view.completed}
            prev={view.prev}
            next={view.next}
          />
        </div>

        {/* Colonne latérale notes */}
        <aside className="md:col-span-1">
          <div style={{ position: "sticky", top: 130 }}>
            <LessonNotes courseId={course.id} initialContent={view.noteContent} />
          </div>
        </aside>
      </div>
    </div>
  );
}
