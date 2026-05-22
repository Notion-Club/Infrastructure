import type { Capability, Program, UserProgress } from "../types";
import { getAllLessonsOrdered } from "../mocks/formation.mock";

// Construit l'URL d'une leçon à partir de son slug et de son module.
function lessonUrl(programSlug: string, moduleSlug: string, lessonSlug: string) {
  return `/formation/${programSlug}/${moduleSlug}/${lessonSlug}`;
}

// Choisit le programme prioritaire pour l'user :
// 1. Devenir consultant Notion (paid) s'il y a la capability paid
// 2. Challenge Gratuit (challenge) s'il y a la capability challenge
// 3. null sinon
function pickPriorityProgram(
  programs: Program[],
  capabilities: Capability[],
): Program | null {
  if (capabilities.includes("can_access_paid_programs")) {
    const paid = programs.find(
      (p) => p.requiredCapability === "can_access_paid_programs",
    );
    if (paid) return paid;
  }
  if (capabilities.includes("can_access_challenge_program")) {
    const challenge = programs.find(
      (p) => p.requiredCapability === "can_access_challenge_program",
    );
    if (challenge) return challenge;
  }
  return null;
}

// Retourne l'URL vers laquelle "Reprendre" doit pointer.
// Logique :
//   1. Trouve le programme prioritaire de l'user
//   2. Si lastAccessedLessonId existe ET référence une leçon du programme → cette URL
//   3. Sinon, première leçon non complétée
//   4. Sinon (tout complété), première leçon du programme
//   5. Si rien → /formation
export function getResumeLink(
  progress: UserProgress,
  programs: Program[],
  capabilities: Capability[] = [
    "can_access_paid_programs",
    "can_access_challenge_program",
  ],
): string {
  const program = pickPriorityProgram(programs, capabilities);
  if (!program) return "/formation";

  const lessons = getAllLessonsOrdered(program);
  if (lessons.length === 0) return "/formation";

  if (progress.lastAccessedLessonId) {
    for (const mod of program.modules) {
      const match = mod.lessons.find(
        (l) => l.id === progress.lastAccessedLessonId,
      );
      if (match) return lessonUrl(program.slug, mod.slug, match.slug);
    }
  }

  const firstUncompleted = lessons.find(
    (l) => !progress.completedLessonIds.includes(l.id),
  );
  if (firstUncompleted) {
    const mod = program.modules.find((m) =>
      m.lessons.some((l) => l.id === firstUncompleted.id),
    );
    if (mod) return lessonUrl(program.slug, mod.slug, firstUncompleted.slug);
  }

  const firstLesson = lessons[0];
  const firstModule = program.modules.find((m) =>
    m.lessons.some((l) => l.id === firstLesson.id),
  );
  if (firstModule) {
    return lessonUrl(program.slug, firstModule.slug, firstLesson.slug);
  }
  return "/formation";
}
