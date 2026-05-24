// Lecture de la structure Formation depuis Notion (server-only).
//
// Hiérarchie Notion :
//   Formations (base) ──< Modules (base) ──< Cours (base)
// Reconstruite ici en un arbre exploitable par la sync Supabase.
//
// On NE récupère PAS le body des cours ici (markdown lazy-load au clic).

import {
  queryDatabaseAll,
  getTitle,
  getRichText,
  getNumber,
  getCheckbox,
  getRelationIds,
  getFirstFileUrl,
  normalizeNotionId,
  type NotionPage,
} from "@/shared/lib/notion/client";

// Database IDs (API publique Notion) — dérivés des URLs des bases.
export const FORMATION_DB_IDS = {
  formations: "369bad05-6a95-803e-93e9-f3125b68ec28",
  modules: "a51bad05-6a95-830f-8f8e-010385f76086",
  cours: "346bad05-6a95-8357-a708-0152dc9fa012",
} as const;

export type NotionCourse = {
  notionId: string;
  name: string;
  description: string;
  position: number;
  isDefault: boolean;
  moduleNotionId: string | null;
  formationNotionId: string | null;
};

export type NotionModule = {
  notionId: string;
  name: string;
  position: number;
  coverUrl: string | null;
  formationNotionIds: string[];
  courses: NotionCourse[];
};

export type NotionFormation = {
  notionId: string;
  name: string;
  description: string;
  position: number;
  modules: NotionModule[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function parseCourse(page: NotionPage): NotionCourse {
  const moduleIds = getRelationIds(page, "Module");
  const formationIds = getRelationIds(page, "Formation");
  return {
    notionId: normalizeNotionId(page.id),
    name: getTitle(page, "Name"),
    description: getRichText(page, "Description"),
    position: getNumber(page, "Numérotation ") ?? 0,
    isDefault: getCheckbox(page, "Default Course"),
    moduleNotionId: moduleIds[0] ?? null,
    formationNotionId: formationIds[0] ?? null,
  };
}

function parseModule(page: NotionPage): Omit<NotionModule, "courses"> {
  return {
    notionId: normalizeNotionId(page.id),
    name: getTitle(page, "Nom"),
    position: getNumber(page, "ID") ?? 0,
    coverUrl: getFirstFileUrl(page, "Couverture"),
    formationNotionIds: getRelationIds(page, "Formations"),
  };
}

// Récupère et reconstruit l'arbre complet Formations → Modules → Cours.
// 3 appels database (une par base) + reconstruction en mémoire via relations.
export async function fetchFormationsTree(): Promise<NotionFormation[]> {
  const [formationPages, modulePages, coursePages] = await Promise.all([
    queryDatabaseAll(FORMATION_DB_IDS.formations),
    queryDatabaseAll(FORMATION_DB_IDS.modules),
    queryDatabaseAll(FORMATION_DB_IDS.cours),
  ]);

  const courses = coursePages.map(parseCourse);
  const coursesByModule = new Map<string, NotionCourse[]>();
  for (const c of courses) {
    if (!c.moduleNotionId) continue;
    const list = coursesByModule.get(c.moduleNotionId) ?? [];
    list.push(c);
    coursesByModule.set(c.moduleNotionId, list);
  }

  const modules: NotionModule[] = modulePages.map((p) => {
    const base = parseModule(p);
    const moduleCourses = (coursesByModule.get(base.notionId) ?? []).sort(
      (a, b) => a.position - b.position,
    );
    return { ...base, courses: moduleCourses };
  });

  const modulesByFormation = new Map<string, NotionModule[]>();
  for (const m of modules) {
    for (const fId of m.formationNotionIds) {
      const list = modulesByFormation.get(fId) ?? [];
      list.push(m);
      modulesByFormation.set(fId, list);
    }
  }

  return formationPages.map((p, idx) => {
    const notionId = normalizeNotionId(p.id);
    const name = getTitle(p, "Name");
    const formationModules = (modulesByFormation.get(notionId) ?? []).sort(
      (a, b) => a.position - b.position,
    );
    return {
      notionId,
      name,
      description: getRichText(p, "Description"),
      position: idx,
      modules: formationModules,
    };
  });
}

export { slugify };
