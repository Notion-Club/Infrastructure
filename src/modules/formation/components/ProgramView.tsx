import { PartyPopper } from "@/shared/components/icons";

import { ProgressBar } from "@/shared/components/dashboard/widgets/ProgressBar";
import type { ProgramDetail } from "../types";
import { ModuleAccordion } from "./ModuleAccordion";
import { LessonReady } from "./LessonTransition";
import { FormationBackLink } from "./FormationBackLink";
import { ResumeLessonButton } from "./ResumeLessonButton";

// Page programme (Server Component). Le module contenant la prochaine leçon
// à faire est ouvert par défaut. `openModuleSlug` (deep-link depuis le fil
// d'Ariane d'une leçon) prend le dessus et déclenche le dépliage animé.
export function ProgramView({
  detail,
  openModuleSlug,
}: {
  detail: ProgramDetail;
  openModuleSlug?: string;
}) {
  const isComplete = detail.percent === 100 && detail.totalCourses > 0;

  // #102 — lien « reprendre » vers la prochaine leçon à suivre (la première
  // leçon non terminée / débloquée, marquée isNext). Masqué si le programme est
  // terminé (l'encadré de félicitations prend le relais).
  let resumeHref: string | null = null;
  for (const m of detail.modules) {
    const next = m.courses.find((c) => c.isNext && !c.locked);
    if (next) {
      resumeHref = `/formation/${detail.slug}/${m.slug}/${next.slug}`;
      break;
    }
  }

  const deepLinkModule = openModuleSlug
    ? detail.modules.find((m) => m.slug === openModuleSlug)
    : undefined;

  const defaultOpenModuleId =
    deepLinkModule?.id ??
    detail.modules.find((m) => m.courses.some((c) => c.isNext))?.id ??
    detail.modules[0]?.id ??
    null;

  return (
    <div data-fb-label="Page programme" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <FormationBackLink />

      <header data-fb-label="En-tête programme · Page programme" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1
          style={{
            fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {detail.name}
        </h1>
        {detail.description && (
          <p style={{ fontSize: 16, color: "var(--color-text-secondary)", margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
            {detail.description}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, maxWidth: 480 }}>
          <ProgressBar percent={detail.percent} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--color-text-muted)" }}>
            <span>
              {detail.completedCourses} / {detail.totalCourses} leçons complétées
            </span>
            <span style={{ fontWeight: 600, color: "var(--color-brand)" }}>{detail.percent}%</span>
          </div>
        </div>

        {!isComplete && resumeHref && <ResumeLessonButton href={resumeHref} />}

        {isComplete && (
          <div
            data-fb-label="Encadré programme terminé · Page programme"
            style={{
              marginTop: 4,
              background: "linear-gradient(110deg, rgba(224,98,90,0.10), rgba(224,98,90,0.03))",
              border: "1px solid rgba(224,98,90,0.25)",
              borderRadius: 16,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <PartyPopper size={22} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
              Félicitations, tu as terminé {detail.name}.
            </p>
          </div>
        )}
      </header>

      <section data-fb-label="Liste des modules · Page programme" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {detail.modules.map((m) => (
          <ModuleAccordion
            key={m.id}
            programSlug={detail.slug}
            module={m}
            defaultOpen={m.id === defaultOpenModuleId}
            animateOpen={deepLinkModule != null && m.id === deepLinkModule.id}
          />
        ))}
      </section>
      <LessonReady />
    </div>
  );
}
