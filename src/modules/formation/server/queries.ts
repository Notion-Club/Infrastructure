// Lecture de la structure + progression depuis Supabase (server-only).
//
// Utilise le client serveur lié à la session : la RLS filtre automatiquement
// les formations selon les capabilities de l'utilisateur. La progression est
// jointe par profile_id = utilisateur courant.

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type {
  CourseRow,
  FormationAccessMode,
  LessonTreeModule,
  LessonView,
  ModuleWithCourses,
  ProgramDetail,
  ProgramSummary,
} from "../types";

type FormationRow = {
  id: string;
  notion_id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
};

type ModuleRow = {
  id: string;
  slug: string;
  name: string;
  position: number;
  cover_url: string | null;
  formation_id: string;
};

type CourseDbRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  module_id: string;
  formation_id: string;
  notion_id: string;
};

type ProgressRow = {
  course_id: string;
  status: string;
  last_accessed_at: string;
};

async function getUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Map notion_formation_id → access_mode (config). Lue séparément car
// formation_access n'a pas de FK vers formations (clé par notion id).
async function getAccessModeMap(): Promise<Map<string, FormationAccessMode>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("formation_access")
    .select("notion_formation_id, access_mode");
  const map = new Map<string, FormationAccessMode>();
  for (const row of data ?? []) {
    map.set(
      (row as { notion_formation_id: string }).notion_formation_id,
      (row as { access_mode: FormationAccessMode }).access_mode,
    );
  }
  return map;
}

function courseHref(programSlug: string, moduleSlug: string, courseSlug: string) {
  return `/formation/${programSlug}/${moduleSlug}/${courseSlug}`;
}

// ─── Index : programmes accessibles + progression agrégée ───────────────
export async function getAccessiblePrograms(): Promise<ProgramSummary[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserId();

  const { data: formations } = await supabase
    .from("formations")
    .select("id, notion_id, slug, name, description, position")
    .order("position", { ascending: true });

  if (!formations || formations.length === 0) return [];

  const accessModes = await getAccessModeMap();

  const formationIds = (formations as FormationRow[]).map((f) => f.id);
  const { data: courses } = await supabase
    .from("formation_courses")
    .select("id, slug, name, position, module_id, formation_id")
    .in("formation_id", formationIds)
    .order("position", { ascending: true });

  const { data: modules } = await supabase
    .from("formation_modules")
    .select("id, slug, position, formation_id")
    .in("formation_id", formationIds)
    .order("position", { ascending: true });

  const progress = userId
    ? (
        await supabase
          .from("formation_course_progress")
          .select("course_id, status, last_accessed_at")
          .eq("profile_id", userId)
      ).data ?? []
    : [];

  const completedSet = new Set(
    (progress as ProgressRow[])
      .filter((p) => p.status === "completed")
      .map((p) => p.course_id),
  );
  const lastAccessed = (progress as ProgressRow[])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.last_accessed_at).getTime() -
        new Date(a.last_accessed_at).getTime(),
    )[0];

  const moduleSlugById = new Map(
    (modules as Pick<ModuleRow, "id" | "slug" | "position" | "formation_id">[]).map(
      (m) => [m.id, m],
    ),
  );

  return (formations as FormationRow[]).map((f) => {
    const fCourses = (courses as CourseDbRow[])
      .filter((c) => c.formation_id === f.id)
      .sort((a, b) => {
        const ma = moduleSlugById.get(a.module_id)?.position ?? 0;
        const mb = moduleSlugById.get(b.module_id)?.position ?? 0;
        return ma - mb || a.position - b.position;
      });

    const total = fCourses.length;
    const completed = fCourses.filter((c) => completedSet.has(c.id)).length;

    // Resume : dernière leçon accédée si elle est dans cette formation,
    // sinon première leçon non complétée.
    let resumeCourse: CourseDbRow | undefined;
    if (lastAccessed) {
      resumeCourse = fCourses.find((c) => c.id === lastAccessed.course_id);
    }
    if (!resumeCourse) {
      resumeCourse = fCourses.find((c) => !completedSet.has(c.id));
    }

    const resumeHref = resumeCourse
      ? courseHref(
          f.slug,
          moduleSlugById.get(resumeCourse.module_id)?.slug ?? "",
          resumeCourse.slug,
        )
      : null;

    return {
      id: f.id,
      slug: f.slug,
      name: f.name,
      description: f.description,
      accessMode: accessModes.get(f.notion_id) ?? "strict",
      totalCourses: total,
      completedCourses: completed,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      resumeHref,
      nextCourseLabel: resumeCourse && completed < total ? resumeCourse.name : null,
    } satisfies ProgramSummary;
  });
}

// ─── Page programme : modules + cours + progression ─────────────────────
export async function getProgramDetail(
  programSlug: string,
): Promise<ProgramDetail | null> {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserId();

  const { data: formation } = await supabase
    .from("formations")
    .select("id, notion_id, slug, name, description, position")
    .eq("slug", programSlug)
    .maybeSingle<FormationRow>();

  if (!formation) return null;

  const accessModes = await getAccessModeMap();

  const { data: modulesData } = await supabase
    .from("formation_modules")
    .select("id, slug, name, position, cover_url, formation_id")
    .eq("formation_id", formation.id)
    .order("position", { ascending: true });

  const { data: coursesData } = await supabase
    .from("formation_courses")
    .select("id, slug, name, description, position, module_id, formation_id, notion_id")
    .eq("formation_id", formation.id)
    .order("position", { ascending: true });

  const progress = userId
    ? (
        await supabase
          .from("formation_course_progress")
          .select("course_id, status, last_accessed_at")
          .eq("profile_id", userId)
      ).data ?? []
    : [];
  const completedSet = new Set(
    (progress as ProgressRow[])
      .filter((p) => p.status === "completed")
      .map((p) => p.course_id),
  );

  const modules = (modulesData ?? []) as ModuleRow[];
  const courses = (coursesData ?? []) as CourseDbRow[];
  const accessMode = accessModes.get(formation.notion_id) ?? "strict";

  // Ordre global pour le drip + détection "next".
  const ordered = courses.slice().sort((a, b) => {
    const ma = modules.find((m) => m.id === a.module_id)?.position ?? 0;
    const mb = modules.find((m) => m.id === b.module_id)?.position ?? 0;
    return ma - mb || a.position - b.position;
  });
  const firstIncompleteId = ordered.find((c) => !completedSet.has(c.id))?.id ?? null;

  function isLocked(courseId: string): boolean {
    if (accessMode !== "strict") return false;
    const idx = ordered.findIndex((c) => c.id === courseId);
    if (idx <= 0) return false;
    return !completedSet.has(ordered[idx - 1].id);
  }

  const modulesWithCourses: ModuleWithCourses[] = modules.map((m) => {
    const mCourses = courses
      .filter((c) => c.module_id === m.id)
      .sort((a, b) => a.position - b.position);
    const rows: CourseRow[] = mCourses.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      position: c.position,
      completed: completedSet.has(c.id),
      locked: isLocked(c.id),
      isNext: c.id === firstIncompleteId,
    }));
    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      position: m.position,
      coverUrl: m.cover_url,
      courses: rows,
      completedCount: rows.filter((r) => r.completed).length,
      totalCount: rows.length,
    };
  });

  const total = courses.length;
  const completed = courses.filter((c) => completedSet.has(c.id)).length;

  return {
    id: formation.id,
    slug: formation.slug,
    name: formation.name,
    description: formation.description,
    accessMode,
    modules: modulesWithCourses,
    totalCourses: total,
    completedCourses: completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

// ─── Page leçon : résolution + accès + voisins + note ───────────────────
export async function getLessonView(
  programSlug: string,
  moduleSlug: string,
  courseSlug: string,
): Promise<
  | { ok: true; view: LessonView }
  | { ok: false; reason: "not_found" | "no_capability" | "drip_locked"; redirectTo: string }
> {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserId();

  const { data: formation } = await supabase
    .from("formations")
    .select("id, notion_id, slug, name")
    .eq("slug", programSlug)
    .maybeSingle<FormationRow>();

  // RLS : si pas de capability, la formation n'est pas visible → not_found
  // côté requête. On redirige vers /formation avec un message générique.
  if (!formation) {
    return { ok: false, reason: "no_capability", redirectTo: "/formation" };
  }

  const accessModes = await getAccessModeMap();
  const accessMode = accessModes.get(formation.notion_id) ?? "strict";

  const { data: mod } = await supabase
    .from("formation_modules")
    .select("id, slug, name")
    .eq("formation_id", formation.id)
    .eq("slug", moduleSlug)
    .maybeSingle<ModuleRow>();

  if (!mod) {
    return { ok: false, reason: "not_found", redirectTo: `/formation/${programSlug}` };
  }

  const { data: course } = await supabase
    .from("formation_courses")
    .select("id, slug, name, description, position, module_id, formation_id, notion_id")
    .eq("module_id", mod.id)
    .eq("slug", courseSlug)
    .maybeSingle<CourseDbRow>();

  if (!course) {
    return { ok: false, reason: "not_found", redirectTo: `/formation/${programSlug}` };
  }

  // Ordre global de la formation pour drip + voisins.
  const [{ data: allModules }, { data: allCourses }, progressRes, noteRes] =
    await Promise.all([
      supabase
        .from("formation_modules")
        .select("id, slug, name, position")
        .eq("formation_id", formation.id)
        .order("position", { ascending: true }),
      supabase
        .from("formation_courses")
        .select("id, slug, name, position, module_id")
        .eq("formation_id", formation.id),
      userId
        ? supabase
            .from("formation_course_progress")
            .select("course_id, status, last_accessed_at")
            .eq("profile_id", userId)
        : Promise.resolve({ data: [] as ProgressRow[] }),
      userId
        ? supabase
            .from("formation_course_notes")
            .select("content")
            .eq("profile_id", userId)
            .eq("course_id", course.id)
            .maybeSingle<{ content: string }>()
        : Promise.resolve({ data: null }),
    ]);

  const modules = (allModules ?? []) as Pick<
    ModuleRow,
    "id" | "slug" | "name" | "position"
  >[];
  const courses = (allCourses ?? []) as Pick<
    CourseDbRow,
    "id" | "slug" | "name" | "position" | "module_id"
  >[];
  const completedSet = new Set(
    ((progressRes.data ?? []) as ProgressRow[])
      .filter((p) => p.status === "completed")
      .map((p) => p.course_id),
  );

  const ordered = courses.slice().sort((a, b) => {
    const ma = modules.find((m) => m.id === a.module_id)?.position ?? 0;
    const mb = modules.find((m) => m.id === b.module_id)?.position ?? 0;
    return ma - mb || a.position - b.position;
  });
  const idx = ordered.findIndex((c) => c.id === course.id);

  // Drip strict : leçon précédente doit être complétée.
  if (accessMode === "strict" && idx > 0) {
    const prev = ordered[idx - 1];
    if (!completedSet.has(prev.id) && !completedSet.has(course.id)) {
      return {
        ok: false,
        reason: "drip_locked",
        redirectTo: `/formation/${programSlug}`,
      };
    }
  }

  const moduleById = new Map(modules.map((m) => [m.id, m]));
  function neighbour(n: number) {
    const c = ordered[n];
    if (!c) return null;
    const m = moduleById.get(c.module_id);
    if (!m) return null;
    return { moduleSlug: m.slug, courseSlug: c.slug, name: c.name };
  }

  // Verrouillage drip (mode strict) : la leçon précédente doit être complétée.
  function lockedAt(courseId: string): boolean {
    if (accessMode !== "strict") return false;
    const i = ordered.findIndex((c) => c.id === courseId);
    if (i <= 0) return false;
    return !completedSet.has(ordered[i - 1].id);
  }

  // Arbre complet de la formation (modules → cours) pour le file-tree du fil
  // d'Ariane. Construit à partir des données déjà chargées (aucune requête sup.).
  const tree: LessonTreeModule[] = modules
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      courses: courses
        .filter((c) => c.module_id === m.id)
        .sort((a, b) => a.position - b.position)
        .map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          completed: completedSet.has(c.id),
          locked: lockedAt(c.id),
        })),
    }));

  const view: LessonView = {
    formation: { slug: formation.slug, name: formation.name },
    module: { slug: mod.slug, name: mod.name },
    course: {
      id: course.id,
      slug: course.slug,
      name: course.name,
      description: course.description,
      notionId: course.notion_id,
    },
    noteContent: (noteRes.data as { content: string } | null)?.content ?? "",
    completed: completedSet.has(course.id),
    prev: idx > 0 ? neighbour(idx - 1) : null,
    next: idx >= 0 && idx < ordered.length - 1 ? neighbour(idx + 1) : null,
    accessMode,
    tree,
  };

  return { ok: true, view };
}
