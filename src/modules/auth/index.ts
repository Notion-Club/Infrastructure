// Public API du module `auth`.
// Tout import depuis l'extérieur (app/, autres modules autorisés) doit passer par ce fichier.
export { SignupForm } from "./components/SignupForm";
export { LoginForm } from "./components/LoginForm";
export { LogoutButton } from "./components/LogoutButton";
export { GoogleSignInButton } from "./components/GoogleSignInButton";
export {
  signUpAction,
  signInAction,
  signInWithGoogleAction,
  signOutAction,
} from "./server/actions";
