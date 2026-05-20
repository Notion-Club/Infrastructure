// Public API du module `settings`.
// Tout import depuis l'extérieur (app/, autres modules autorisés) doit passer
// par ce fichier.
export {
  updatePasswordWithReauthAction,
  updateProfileAction,
  updateAccountEmailAction,
  uploadAvatarAction,
  updateAvatarColorAction,
  removeAvatarAction,
  deleteAccountAction,
  type PasswordChangeResult,
  type ProfileUpdateResult,
  type AccountEmailChangeResult,
  type AvatarUploadResult,
  type AvatarColorChangeResult,
  type AvatarRemoveResult,
  type DeleteAccountResult,
} from "./server/actions";

export {
  passwordChangeSchema,
  profileUpdateSchema,
  accountEmailChangeSchema,
  avatarColorChangeSchema,
  deleteAccountSchema,
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_MIME,
  AVATAR_COLOR_PALETTE,
  DEFAULT_AVATAR_COLOR,
  BIO_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  isAllowedAvatarMime,
  isAllowedAvatarColor,
  type PasswordChangeInput,
  type ProfileUpdateInput,
  type AccountEmailChangeInput,
  type AvatarColorChangeInput,
  type AvatarColor,
  type DeleteAccountInput,
} from "./lib/validation";
