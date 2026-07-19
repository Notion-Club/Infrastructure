// Queries spécifiques aux widgets du dashboard.
//
// Réutilise getAccessiblePrograms() (cache RLS, capabilities, progression
// jointe) et en dérive deux view-models compacts :
//   - DashboardFormationData : pour FormationWidget (dernier cours accédé,
//     progression du programme courant)
//   - DashboardProfilData : pour ProfilWidget (niveau global basé sur le
//     nombre de modules entièrement complétés, agrégé sur toutes les
//     formations accessibles)
//
// Décision : pas de table user_progression V1. Le "niveau" est calculé à la
// volée. Système de niveau aligné sur la formule Notion historique de Théo :
// 9 niveaux nommés indexés sur le nombre de modules entièrement terminés.

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { getAuthUser } from "@/shared/lib/supabase/cached";
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

// Système de niveau aligné sur la formule Notion de Théo (octobre 2025) —
// 9 niveaux nommés indexés sur le nombre de modules entièrement terminés
// (= modules dont TOUS les cours sont en status "completed").
//
// Mapping modules terminés → niveau :
//   0 ou 1 → Niveau 1 Débutant
//   2 → Niveau 2 Explorateur
//   3 → Niveau 3 Stratège
//   4 → Niveau 4 Conquérant
//   5 ou 6 → Niveau 5 Architecte
//   7 → Niveau 6 Créateur de solutions
//   8 → Niveau 7 Magicien de productivité
//   9 → Niveau 8 Partenaire de confiance
//   > 9 → Niveau 9 Expert Notion
export type LevelLabel =
  | "Débutant"
  | "Explorateur"
  | "Stratège"
  | "Conquérant"
  | "Architecte"
  | "Créateur de solutions"
  | "Magicien de productivité"
  | "Partenaire de confiance"
  | "Expert Notion";

export interface DashboardProfilData {
  level: number; // 1..9
  levelLabel: LevelLabel;
  // 'completed' si tous les modules terminés, 'not_started' si 0,
  // 'in_progress' sinon.
  status: "not_started" | "in_progress" | "completed";
  // Compteurs bruts pour la copie dynamique du widget.
  modulesCompleted: number;
  modulesTotal: number;
}

// Mapping modules terminés → (niveau, label).
// Reproduit fidèlement la formule Notion historique de Théo.
function computeLevel(modulesCompleted: number): {
  level: number;
  levelLabel: LevelLabel;
} {
  if (modulesCompleted <= 1) return { level: 1, levelLabel: "Débutant" };
  if (modulesCompleted === 2) return { level: 2, levelLabel: "Explorateur" };
  if (modulesCompleted === 3) return { level: 3, levelLabel: "Stratège" };
  if (modulesCompleted === 4) return { level: 4, levelLabel: "Conquérant" };
  if (modulesCompleted <= 6) return { level: 5, levelLabel: "Architecte" };
  if (modulesCompleted === 7)
    return { level: 6, levelLabel: "Créateur de solutions" };
  if (modulesCompleted === 8)
    return { level: 7, levelLabel: "Magicien de productivité" };
  if (modulesCompleted === 9)
    return { level: 8, levelLabel: "Partenaire de confiance" };
  return { level: 9, levelLabel: "Expert Notion" };
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
//
// Un module est "terminé" quand TOUS ses cours sont en status "completed".
// On compte les modules entièrement terminés sur l'ensemble des formations
// accessibles à l'user (filtre via formation_access + capabilities), puis on
// dérive le niveau via computeLevel().
export async function getDashboardProfilData(): Promise<DashboardProfilData | null> {
  const programs = await getAccessiblePrograms();
  if (programs.length === 0) return null;

  const supabase = await createSupabaseServerClient();
  // getUser() mémoïsé (cache()) — même user que le layout, sans nouvel
  // aller-retour réseau vers Supabase Auth au chargement du dashboard.
  const user = await getAuthUser();

  // Récupère les ids des formations accessibles à l'user (via la même logique
  // que getAccessiblePrograms — déjà filtré par capabilities + access mode).
  const formationSlugs = programs.map((p) => p.slug);
  const { data: formations } = await supabase
    .from("formations")
    .select("id")
    .in("slug", formationSlugs);
  const formationIds = (formations as { id: string }[] | null)?.map((f) => f.id) ?? [];

  if (formationIds.length === 0) {
    return {
      level: 1,
      levelLabel: "Débutant",
      status: "not_started",
      modulesCompleted: 0,
      modulesTotal: 0,
    };
  }

  // Charge tous les modules + cours des formations accessibles, ainsi que la
  // progression complétée de l'user en une seule passe.
  const [modulesRes, coursesRes, progressRes] = await Promise.all([
    supabase
      .from("formation_modules")
      .select("id")
      .in("formation_id", formationIds),
    supabase
      .from("formation_courses")
      .select("id, module_id")
      .in("formation_id", formationIds),
    user
      ? supabase
          .from("formation_course_progress")
          .select("course_id")
          .eq("profile_id", user.id)
          .eq("status", "completed")
      : Promise.resolve({ data: [] }),
  ]);

  const moduleIds = (modulesRes.data as { id: string }[] | null)?.map((m) => m.id) ?? [];
  const courses = (coursesRes.data as { id: string; module_id: string }[] | null) ?? [];
  const completedCourseIds = new Set(
    ((progressRes.data as { course_id: string }[] | null) ?? []).map(
      (p) => p.course_id,
    ),
  );

  // Pour chaque module, vérifie si TOUS ses cours sont complétés.
  // Modules sans cours sont ignorés (ne comptent ni comme "terminé" ni dans
  // le total — sinon un module vide serait toujours marqué terminé).
  let modulesCompleted = 0;
  let modulesTotal = 0;
  for (const moduleId of moduleIds) {
    const moduleCourses = courses.filter((c) => c.module_id === moduleId);
    if (moduleCourses.length === 0) continue;
    modulesTotal += 1;
    const allDone = moduleCourses.every((c) => completedCourseIds.has(c.id));
    if (allDone) modulesCompleted += 1;
  }

  const lvl = computeLevel(modulesCompleted);

  let status: DashboardProfilData["status"];
  if (modulesCompleted === 0) status = "not_started";
  else if (modulesCompleted >= modulesTotal) status = "completed";
  else status = "in_progress";

  return {
    level: lvl.level,
    levelLabel: lvl.levelLabel,
    status,
    modulesCompleted,
    modulesTotal,
  };
}
