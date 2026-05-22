// Public API du module `auth`.
// Tout import depuis l'extérieur (app/, autres modules autorisés) doit passer par ce fichier.
export { SignupForm } from "./components/SignupForm";
export { LoginForm } from "./components/LoginForm";
export { LogoutButton } from "./components/LogoutButton";
export { GoogleSignInButton } from "./components/GoogleSignInButton";
export { EmailVerifiedToast } from "./components/EmailVerifiedToast";
export { ResetPasswordRequestForm } from "./components/ResetPasswordRequestForm";
export { UpdatePasswordForm } from "./components/UpdatePasswordForm";

// Mockup statique (étape 1 — zéro logique Supabase).
export { AuthCard, type AuthCardState } from "./components/AuthCard";
export { AuthMockup } from "./components/AuthMockup";
export { GoogleButton } from "./components/GoogleButton";

export {
  signUpAction,
  signInAction,
  signInWithGoogleAction,
  signOutAction,
  resendVerificationEmailAction,
  updatePasswordFromRecoveryAction,
  type RecoveryPasswordChangeResult,
} from "./server/actions";
