// Types publics du module `formation` (Brique 2 — branché sur Notion + Supabase).
//
// Ces view-models sont produits par la couche server/queries.ts (lecture
// Supabase, RLS appliquée) et consommés par les composants des 3 écrans.

export type FormationAccessMode = "strict" | "open" | "hybrid";

// Index — une card par formation accessible.
export type ProgramSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accessMode: FormationAccessMode;
  totalCourses: number;
  completedCourses: number;
  percent: number;
  resumeHref: string | null;
  nextCourseLabel: string | null;
};

// Page programme — une ligne par cours dans un module.
export type CourseRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  completed: boolean;
  locked: boolean;
  isNext: boolean;
};

export type ModuleWithCourses = {
  id: string;
  slug: string;
  name: string;
  position: number;
  coverUrl: string | null;
  courses: CourseRow[];
  completedCount: number;
  totalCount: number;
};

export type ProgramDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accessMode: FormationAccessMode;
  modules: ModuleWithCourses[];
  totalCourses: number;
  completedCourses: number;
  percent: number;
};

// Page leçon.
export type LessonNeighbour = {
  moduleSlug: string;
  courseSlug: string;
  name: string;
};

export type LessonView = {
  formation: { slug: string; name: string };
  module: { slug: string; name: string };
  course: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    notionId: string;
  };
  noteContent: string;
  completed: boolean;
  prev: LessonNeighbour | null;
  next: LessonNeighbour | null;
  accessMode: FormationAccessMode;
};
