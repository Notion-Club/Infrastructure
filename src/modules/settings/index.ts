// Public API du module `settings`.
// Tout import depuis l'extérieur (app/, autres modules autorisés) doit passer
// par ce fichier.
export {
  updatePasswordWithReauthAction,
  updateProfileAction,
  updateAccountEmailAction,
  uploadAvatarAction,
  deleteAccountAction,
  type PasswordChangeResult,
  type ProfileUpdateResult,
  type AccountEmailChangeResult,
  type AvatarUploadResult,
  type DeleteAccountResult,
} from "./server/actions";

export {
  passwordChangeSchema,
  profileUpdateSchema,
  accountEmailChangeSchema,
  deleteAccountSchema,
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_MIME,
  isAllowedAvatarMime,
  type PasswordChangeInput,
  type ProfileUpdateInput,
  type AccountEmailChangeInput,
  type DeleteAccountInput,
} from "./lib/validation";
