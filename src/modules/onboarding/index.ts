// Public API du module `onboarding`.
// Tout import depuis un autre module doit passer par ce fichier.

// Server Actions
export {
  updateOnboardingProfileAction,
  type OnboardingResult,
} from "./server/actions";

// Server Queries (lecture profil + check complétion)
export {
  isOnboardingComplete,
  getOnboardingProfile,
  type OnboardingProfile,
} from "./server/queries";

// Validation (utilisable côté client pour parser le form)
export {
  onboardingProfileSchema,
  type OnboardingProfileInput,
} from "./lib/validation";
