// Types publics du module `formation` (Brique 2 — Modèle des contenus formation).
//
// Ces types décrivent le contrat visuel que la maquette statique attend
// des futures données Supabase. Ils sont consommés par les mocks, les
// composants UI et les utilitaires. Quand Nathan branche Supabase, il
// devra produire ces mêmes shapes côté serveur.

export type AccessMode = "strict" | "hybrid" | "open";

export type Capability =
  | "can_access_challenge_program"
  | "can_access_paid_programs";

export type ModuleSection = "architecte" | "business" | null;

export type LessonResource = {
  id: string;
  cachedTitle: string;
  cachedDescription: string;
  cachedType: string;
  cachedFormation: "Notion Architecte" | "Notion Business" | null;
  cachedUrl: string | null;
};

export type Lesson = {
  id: string;
  slug: string;
  title: string;
  description: string;
  videoUrl: string | null;
  videoDurationSeconds: number | null;
  isSalesLesson: boolean;
  position: number;
  resources: LessonResource[];
};

export type FormationModule = {
  id: string;
  slug: string;
  name: string;
  description: string;
  section: ModuleSection;
  accessMode: AccessMode | null;
  position: number;
  lessons: Lesson[];
};

export type Program = {
  id: string;
  slug: string;
  name: string;
  description: string;
  requiredCapability: Capability;
  accessMode: AccessMode;
  modules: FormationModule[];
};

export type UserProgress = {
  completedLessonIds: string[];
  lessonNotes: Record<string, string>;
  lastAccessedLessonId: string | null;
};

export type DevSpecialState = "normal" | "lesson_locked" | "resource_deleted";

export type DevCapability =
  | "none"
  | "challenge_only"
  | "paid_only"
  | "paid_and_challenge";

export type DevProgressLevel = 0 | 30 | 70 | 100;
