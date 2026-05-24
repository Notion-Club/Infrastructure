// API publique du module `formation`.
// Tout import depuis @/app/* ou un autre module doit passer par ce fichier.

// Composants d'écran
export { FormationIndex } from "./components/FormationIndex";
export { ProgramView } from "./components/ProgramView";
export { LessonView } from "./components/LessonView";
export { FormationToasts } from "./components/FormationToasts";

// Lecture (server)
export {
  getAccessiblePrograms,
  getProgramDetail,
  getLessonView,
} from "./server/queries";

// Mutations (server actions)
export {
  markCourseCompleted,
  touchCourseAccess,
  saveCourseNote,
} from "./server/actions";

// Sync Notion → Supabase
export { syncFormationsFromNotion } from "./server/sync";

// Contenu leçon lazy (vidéo + Synthèse + ressources/templates liés)
export { fetchLessonContent } from "./server/notion";
export type { LessonContent, LessonResourceLink } from "./server/notion";

export type {
  FormationAccessMode,
  ProgramSummary,
  ProgramDetail,
  ModuleWithCourses,
  CourseRow,
  LessonView as LessonViewModel,
  LessonNeighbour,
} from "./types";
