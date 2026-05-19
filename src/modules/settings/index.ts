// Public API du module `settings`.
// Tout import depuis l'extérieur (app/, autres modules autorisés) doit passer
// par ce fichier.
export {
  updatePasswordWithReauthAction,
  type PasswordChangeResult,
} from "./server/actions";

export {
  passwordChangeSchema,
  type PasswordChangeInput,
} from "./lib/validation";
