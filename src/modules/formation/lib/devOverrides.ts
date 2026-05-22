import type {
  Capability,
  DevCapability,
  DevProgressLevel,
  Program,
  UserProgress,
} from "../types";

// Mappe la valeur du toggle dev "capability" vers la liste réelle de
// capabilities à passer aux composants.
export function devCapabilityToCapabilities(d: DevCapability): Capability[] {
  switch (d) {
    case "none":
      return [];
    case "challenge_only":
      return ["can_access_challenge_program"];
    case "paid_only":
      return ["can_access_paid_programs"];
    case "paid_and_challenge":
      return ["can_access_paid_programs", "can_access_challenge_program"];
  }
}

// Génère un UserProgress synthétique correspondant au pourcentage du
// toggle dev. Les leçons sont marquées complétées dans l'ordre du
// programme (pour respecter le drip strict).
//
// `lastAccessedLessonId` est posé sur la première leçon NON complétée
// pour rendre crédible le "Reprendre où j'en étais". À 0% : null.
// À 100% : la toute dernière leçon (le user a "terminé" tout).
export function buildProgressFromLevel(
  level: DevProgressLevel,
  programs: Program[],
): UserProgress {
  if (level === 0) {
    return {
      completedLessonIds: [],
      lessonNotes: {},
      lastAccessedLessonId: null,
    };
  }

  const completedIds: string[] = [];
  let lastAccessed: string | null = null;

  for (const program of programs) {
    const ordered = program.modules
      .slice()
      .sort((a, b) => a.position - b.position)
      .flatMap((m) =>
        m.lessons.slice().sort((a, b) => a.position - b.position),
      );

    const target = Math.floor((ordered.length * level) / 100);
    const slice = ordered.slice(0, target);
    completedIds.push(...slice.map((l) => l.id));

    if (level !== 100) {
      const next = ordered[target];
      if (next && !lastAccessed) lastAccessed = next.id;
    } else if (ordered.length > 0 && !lastAccessed) {
      lastAccessed = ordered[ordered.length - 1].id;
    }
  }

  return {
    completedLessonIds: completedIds,
    lessonNotes: {},
    lastAccessedLessonId: lastAccessed,
  };
}

// Stats agrégées pour la barre de progression d'un programme.
export function getProgramStats(
  program: Program,
  progress: UserProgress,
): { totalLessons: number; completedLessons: number; percent: number } {
  const all = program.modules.flatMap((m) => m.lessons);
  const completed = all.filter((l) =>
    progress.completedLessonIds.includes(l.id),
  );
  const percent =
    all.length === 0 ? 0 : Math.round((completed.length / all.length) * 100);
  return {
    totalLessons: all.length,
    completedLessons: completed.length,
    percent,
  };
}

export function getModuleStats(
  module: Program["modules"][number],
  progress: UserProgress,
): { totalLessons: number; completedLessons: number; percent: number } {
  const all = module.lessons;
  const completed = all.filter((l) =>
    progress.completedLessonIds.includes(l.id),
  );
  const percent =
    all.length === 0 ? 0 : Math.round((completed.length / all.length) * 100);
  return {
    totalLessons: all.length,
    completedLessons: completed.length,
    percent,
  };
}
