// Queries spécifiques aux widgets du dashboard.
//
// Réutilise getAccessiblePrograms() (cache RLS, capabilities, progression
// jointe) et en dérive deux view-models compacts :
//   - DashboardFormationData : pour FormationWidget (dernier cours accédé,
//     progression du programme courant)
//   - DashboardProfilData : pour ProfilWidget (niveau global dérivé du %
//     agrégé sur toutes les formations accessibles)
//
// Décision : pas de table user_progression V1. Le "niveau" est calculé à la
// volée depuis le % global. Si Théo veut un système de gamification plus
// élaboré (badges, paliers persistés), on créera la table à ce moment.

import { getAccessiblePrograms } from "./queries";
import type { ProgramSummary } from "../types";

export interface DashboardFormationData {
  // Programme à afficher (dernier accédé ou premier accessible).
  programSlug: string;
  programName: string;
  // Position dans le programme.
  totalCourses: number;
  completedCourses: number;
  percent: number;
  // Lien "Reprendre" — null si tout est complété.
  resumeHref: string | null;
  // Label du prochain cours à faire — null si tout complété.
  nextCourseLabel: string | null;
}

export interface DashboardProfilData {
  // Niveau dérivé du % global agrégé.
  level: number;
  levelLabel: "Débutant" | "Intermédiaire" | "Expert";
  nextLevelLabel: "Intermédiaire" | "Expert" | null;
  // % de progression vers le prochain palier (0..100).
  progressToNextLevel: number;
  // Cours restants pour atteindre le prochain palier.
  coursesRemaining: number;
  totalCoursesAcrossAllPrograms: number;
  completedCoursesAcrossAllPrograms: number;
  // 'in_progress' si au moins un cours en cours, 'completed' si tout fini,
  // 'not_started' si aucun cours touché.
  status: "not_started" | "in_progress" | "completed";
}

// Seuils niveau (à ajuster avec Théo si besoin) :
//   - Niveau 1-5 = Débutant (0..50% du total accessible)
//   - Niveau 6-9 = Intermédiaire (50..90%)
//   - Niveau 10 = Expert (90..100%)
function computeLevel(percent: number, completed: number) {
  if (percent < 50) {
    const level = Math.max(1, Math.ceil(percent / 10)); // 1..5
    const nextThresholdPercent = level * 10;
    return {
      level,
      levelLabel: "Débutant" as const,
      nextLevelLabel: "Intermédiaire" as const,
      progressToNextLevel: Math.round(
        ((percent % 10) / 10) * 100,
      ),
      remainingPctToNextLevel: Math.max(0, nextThresholdPercent - percent),
    };
  }
  if (percent < 90) {
    const level = 5 + Math.max(1, Math.ceil((percent - 50) / 10)); // 6..9
    const nextThresholdPercent = (level - 5) * 10 + 50;
    return {
      level,
      levelLabel: "Intermédiaire" as const,
      nextLevelLabel: "Expert" as const,
      progressToNextLevel: Math.round(
        (((percent - 50) % 10) / 10) * 100,
      ),
      remainingPctToNextLevel: Math.max(0, nextThresholdPercent - percent),
    };
  }
  return {
    level: 10,
    levelLabel: "Expert" as const,
    nextLevelLabel: null,
    progressToNextLevel: 100,
    remainingPctToNextLevel: 0,
  };
  void completed;
}

// Renvoie les données du FormationWidget. null si l'user n'a aucune formation
// accessible (cas free user sans aucun mapping access).
export async function getDashboardFormationData(): Promise<DashboardFormationData | null> {
  const programs = await getAccessiblePrograms();
  if (programs.length === 0) return null;

  // Priorité : programme avec resumeHref (= dernière accédée ou prochaine
  // non complétée). Sinon, premier programme accessible.
  const picked: ProgramSummary =
    programs.find((p) => p.resumeHref !== null) ?? programs[0];

  return {
    programSlug: picked.slug,
    programName: picked.name,
    totalCourses: picked.totalCourses,
    completedCourses: picked.completedCourses,
    percent: picked.percent,
    resumeHref: picked.resumeHref,
    nextCourseLabel: picked.nextCourseLabel,
  };
}

// Renvoie les données du ProfilWidget agrégées sur TOUTES les formations
// accessibles à l'user. null si l'user n'a aucune formation accessible.
export async function getDashboardProfilData(): Promise<DashboardProfilData | null> {
  const programs = await getAccessiblePrograms();
  if (programs.length === 0) return null;

  const total = programs.reduce((acc, p) => acc + p.totalCourses, 0);
  const completed = programs.reduce((acc, p) => acc + p.completedCourses, 0);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const lvl = computeLevel(percent, completed);

  let status: DashboardProfilData["status"];
  if (completed === 0) status = "not_started";
  else if (completed >= total) status = "completed";
  else status = "in_progress";

  // Cours restants ≈ % restant vers le prochain palier × total / 100.
  // Arrondi entier pour affichage "7 modules restants".
  const coursesRemaining = Math.ceil(
    (lvl.remainingPctToNextLevel * total) / 100,
  );

  return {
    level: lvl.level,
    levelLabel: lvl.levelLabel,
    nextLevelLabel: lvl.nextLevelLabel,
    progressToNextLevel: lvl.progressToNextLevel,
    coursesRemaining,
    totalCoursesAcrossAllPrograms: total,
    completedCoursesAcrossAllPrograms: completed,
    status,
  };
}
