import type { AccessMode, FormationModule, Program } from "../types";

// Le mode d'accès effectif d'un module est l'override du module s'il
// existe, sinon le mode hérité du programme. C'est la règle métier
// canonique — utilisée partout (UI, canAccessLesson).
export function getEffectiveAccessMode(
  program: Program,
  module: FormationModule,
): AccessMode {
  return module.accessMode ?? program.accessMode;
}
