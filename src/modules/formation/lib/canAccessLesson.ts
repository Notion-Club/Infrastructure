import type {
  Capability,
  DevSpecialState,
  FormationModule,
  Lesson,
  Program,
  UserProgress,
} from "../types";
import { getEffectiveAccessMode } from "./getEffectiveAccessMode";

export type AccessReason = "no_capability" | "drip_locked" | null;

export type AccessCheck = {
  allowed: boolean;
  reason: AccessReason;
};

// canAccessLesson centralise les deux règles d'accès :
//   1. Capability — l'user a-t-il le bon plan ? (gate dur, simulé par
//      le toggle dev)
//   2. Drip — en mode strict, la leçon précédente doit être complétée.
//      Le mode open ne pose aucun verrou. Le mode hybrid se comporte
//      comme open par défaut dans cette maquette (à raffiner Brique 2).
//
// `forceLocked` (issu du toggle dev "lesson_locked") permet de simuler
// l'état verrouillé même quand la logique stricte ne l'exigerait pas —
// utile pour vérifier les visuels cadenas et toasts.
export function canAccessLesson({
  program,
  module,
  lesson,
  capabilities,
  progress,
  forceLocked,
}: {
  program: Program;
  module: FormationModule;
  lesson: Lesson;
  capabilities: Capability[];
  progress: UserProgress;
  forceLocked?: boolean;
}): AccessCheck {
  if (!capabilities.includes(program.requiredCapability)) {
    return { allowed: false, reason: "no_capability" };
  }

  const mode = getEffectiveAccessMode(program, module);
  if (mode !== "strict") {
    return { allowed: true, reason: null };
  }

  // En mode strict, on regarde la leçon précédente dans l'ordre du
  // module. Si c'est la toute première leçon du tout premier module,
  // elle est accessible d'emblée.
  const orderedModules = program.modules
    .slice()
    .sort((a, b) => a.position - b.position);

  const flatLessons: Array<{ moduleId: string; lessonId: string }> =
    orderedModules.flatMap((m) =>
      m.lessons
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((l) => ({ moduleId: m.id, lessonId: l.id })),
    );

  const idx = flatLessons.findIndex((x) => x.lessonId === lesson.id);
  if (idx <= 0) {
    return forceLocked
      ? { allowed: false, reason: "drip_locked" }
      : { allowed: true, reason: null };
  }

  const prev = flatLessons[idx - 1];
  const prevCompleted = progress.completedLessonIds.includes(prev.lessonId);

  if (forceLocked) {
    return { allowed: false, reason: "drip_locked" };
  }

  return prevCompleted
    ? { allowed: true, reason: null }
    : { allowed: false, reason: "drip_locked" };
}

// Helper : la leçon est-elle la prochaine "à faire" pour l'user ?
// (première leçon non complétée dans l'ordre du programme)
export function isNextLesson({
  program,
  lesson,
  progress,
}: {
  program: Program;
  lesson: Lesson;
  progress: UserProgress;
}): boolean {
  const ordered = program.modules
    .slice()
    .sort((a, b) => a.position - b.position)
    .flatMap((m) => m.lessons.slice().sort((a, b) => a.position - b.position));

  const firstUncompleted = ordered.find(
    (l) => !progress.completedLessonIds.includes(l.id),
  );
  return firstUncompleted?.id === lesson.id;
}

// Pour distinguer un état spécial du toggle dev — utilisé par les pages.
export function shouldForceLock(special: DevSpecialState): boolean {
  return special === "lesson_locked";
}

export function shouldForceDeletedResources(special: DevSpecialState): boolean {
  return special === "resource_deleted";
}
