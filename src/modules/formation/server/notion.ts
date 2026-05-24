// Lecture de la structure Formation depuis Notion (server-only).
//
// Hiérarchie Notion :
//   Formations (base) ──< Modules (base) ──< Cours (base)
// Reconstruite ici en un arbre exploitable par la sync Supabase.
//
// On NE récupère PAS le body des cours ici (markdown lazy-load au clic).

import {
  queryDatabaseAll,
  getPage,
  getTitle,
  getRichText,
  getNumber,
  getCheckbox,
  getSelect,
  getMultiSelect,
  getRelationIds,
  getFirstFileUrl,
  normalizeNotionId,
  type NotionPage,
} from "@/shared/lib/notion/client";
import { fetchPageBlocks, type NotionBlock } from "@/shared/lib/notion/blocks";

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

// ─── Contenu d'une leçon (lazy, à l'ouverture du cours) ─────────────────
//
// Récupère depuis Notion ce qui n'est pas dans le cache Supabase :
//   - l'URL de la vidéo (premier bloc vidéo du body),
//   - la Synthèse (propriété texte « Synthèse » du cours → onglet « À garder
//     en tête »),
//   - les ressources/templates liés (relations « Ressources » + « Templates »)
//     résolus en titre + type + lien vers la page détail /ressources.

export type LessonResourceLink = {
  notionId: string;
  slug: string; // id sans tirets (format slug des routes /ressources)
  title: string;
  category: "resource" | "template";
  typeLabel: string | null;
  href: string;
};

export type LessonContent = {
  videoUrl: string | null;
  blocks: NotionBlock[];
  synthese: string;
  resources: LessonResourceLink[];
};

function dashless(notionId: string): string {
  return notionId.replace(/-/g, "");
}

function findFirstVideoUrl(blocks: NotionBlock[]): string | null {
  for (const b of blocks) {
    if (b.type === "video" && b.url) return b.url;
    if (b.children) {
      const nested = findFirstVideoUrl(b.children);
      if (nested) return nested;
    }
  }
  return null;
}

// Retire les blocs vidéo du body : la vidéo est déjà affichée dans le player
// en tête de carte, on évite le doublon. Le reste du body est conservé.
function stripVideos(blocks: NotionBlock[]): NotionBlock[] {
  return blocks
    .filter((b) => b.type !== "video")
    .map((b) =>
      b.children ? { ...b, children: stripVideos(b.children) } : b,
    );
}

async function resolveResourceLink(
  notionId: string,
): Promise<LessonResourceLink | null> {
  try {
    const page = await getPage(notionId);
    const slug = dashless(notionId);
    return {
      notionId,
      slug,
      title: getTitle(page, "Titre"),
      category: "resource",
      typeLabel: getMultiSelect(page, "Type")[0] ?? null,
      href: `/ressources/ressource/${slug}`,
    };
  } catch {
    return null;
  }
}

async function resolveTemplateLink(
  notionId: string,
): Promise<LessonResourceLink | null> {
  try {
    const page = await getPage(notionId);
    const slug = dashless(notionId);
    return {
      notionId,
      slug,
      title: getTitle(page, "Name"),
      category: "template",
      typeLabel: getSelect(page, "Type"),
      href: `/ressources/template/${slug}`,
    };
  } catch {
    return null;
  }
}

export async function fetchLessonContent(
  courseNotionId: string,
): Promise<LessonContent> {
  const [page, blocks] = await Promise.all([
    getPage(courseNotionId),
    fetchPageBlocks(courseNotionId),
  ]);

  const resourceIds = getRelationIds(page, "Ressources");
  const templateIds = getRelationIds(page, "Templates");

  const [resources, templates] = await Promise.all([
    Promise.all(resourceIds.map(resolveResourceLink)),
    Promise.all(templateIds.map(resolveTemplateLink)),
  ]);

  return {
    videoUrl: findFirstVideoUrl(blocks),
    blocks: stripVideos(blocks),
    synthese: getRichText(page, "Synthèse"),
    resources: [...resources, ...templates].filter(
      (r): r is LessonResourceLink => r !== null && r.title.trim() !== "",
    ),
  };
}
