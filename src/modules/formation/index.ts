// API publique du module `formation`.
// Tout import depuis @/app/* ou un autre module doit passer par ce fichier.

export { FormationProvider, useFormationContext } from "./hooks/useFormationMocks";
export { FormationIndexClient } from "./components/FormationIndexClient";
export { ProgramPageClient } from "./components/ProgramPageClient";
export { LessonPageClient } from "./components/LessonPageClient";
export { DevToggle, DevModeBanner } from "./components/DevToggle";

export { getResumeLink } from "./lib/getResumeLink";
export { MOCK_PROGRAMS } from "./mocks/formation.mock";

export type {
  AccessMode,
  Capability,
  Program,
  FormationModule,
  Lesson,
  LessonResource,
  ModuleSection,
  UserProgress,
  DevCapability,
  DevProgressLevel,
  DevSpecialState,
} from "./types";
