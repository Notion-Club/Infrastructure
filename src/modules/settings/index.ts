// Public API du module `settings`.
// Tout import depuis l'extérieur (app/, autres modules autorisés) doit passer
// par ce fichier.
export {
  updatePasswordWithReauthAction,
  updateProfileAction,
  updateAccountEmailAction,
  uploadAvatarAction,
  type PasswordChangeResult,
  type ProfileUpdateResult,
  type AccountEmailChangeResult,
  type AvatarUploadResult,
} from "./server/actions";

export {
  passwordChangeSchema,
  profileUpdateSchema,
  accountEmailChangeSchema,
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_MIME,
  isAllowedAvatarMime,
  type PasswordChangeInput,
  type ProfileUpdateInput,
  type AccountEmailChangeInput,
} from "./lib/validation";
