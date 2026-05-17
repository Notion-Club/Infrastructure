"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import {
  signinSchema,
  signupSchema,
  type SigninInput,
  type SignupInput,
} from "@/modules/auth/lib/validation";
import { ensureChallengeMembership } from "@/modules/auth/server/membership";

// ============================================================================
// Types de retour communs
// ============================================================================

export type AuthResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "validation"
        | "already_exists"
        | "weak_password"
        | "invalid_credentials"
        | "unknown";
      message: string;
    };

// Message générique pour TOUTES les erreurs login email/password.
// Décision Brique 1 : ne JAMAIS révéler si l'email existe ou non.
const GENERIC_LOGIN_ERROR = "Identifiants incorrects";

// ============================================================================
// signUp — Workflow B (non-bloquant)
// ============================================================================
// 1. Validation zod
// 2. supabase.auth.signUp → crée auth.users + déclenche le trigger profiles
// 3. ensureChallengeMembership → INSERT membership Challenge Gratuit (idempotent)
// 4. Le caller (form) redirige vers /dashboard
export async function signUpAction(input: SignupInput): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { email, password, fullName } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: fullName ? { full_name: fullName } : undefined },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        ok: false,
        code: "already_exists",
        message: "Tu as déjà un compte, va te connecter.",
      };
    }
    if (msg.includes("password")) {
      return { ok: false, code: "weak_password", message: error.message };
    }
    return { ok: false, code: "unknown", message: error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return {
      ok: false,
      code: "unknown",
      message: "Réponse Supabase inattendue (pas d'user id).",
    };
  }

  // Membership best-effort : si elle échoue, l'user est quand même créé.
  // Un job de réconciliation pourra rattraper.
  try {
    await ensureChallengeMembership(userId, "lp_challenge");
  } catch (err) {
    console.error("[signUp] ensureChallengeMembership failed:", err);
  }

  // TODO(resend) : envoi email de bienvenue (Reply-To: RESEND_REPLY_TO_EMAIL).
  // TODO(posthog) : track('user_signed_up_challenge', { user_id: userId }).

  return { ok: true };
}

// ============================================================================
// signIn — email + password
// ============================================================================
// 1. Validation zod
// 2. supabase.auth.signInWithPassword
// 3. Update profiles.last_login_at (sous session user, RLS le permet)
// 4. Le caller redirige vers /dashboard
export async function signInAction(input: SigninInput): Promise<AuthResult> {
  const parsed = signinSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { email, password } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // Erreur générique systématique — pas de leak email-existe-ou-pas.
    return {
      ok: false,
      code: "invalid_credentials",
      message: GENERIC_LOGIN_ERROR,
    };
  }

  await touchLastLoginAt(data.user.id);

  // TODO(posthog) : track('user_logged_in', { method: 'email', user_id: data.user.id }).

  return { ok: true };
}

// ============================================================================
// signInWithGoogle — démarre le flow OAuth
// ============================================================================
// Côté serveur on demande à Supabase une URL d'autorisation Google, puis on
// redirige le browser dessus. Au retour, Google appelle /auth/callback?code=…
// (cf. src/app/auth/callback/route.ts).
//
// `redirect()` de next/navigation throw une NEXT_REDIRECT — c'est intentionnel,
// le caller ne récupère rien.
export async function signInWithGoogleAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    // En cas d'échec, on redirige avec un flag pour afficher un toast.
    redirect("/login?error=oauth_init_failed");
  }

  redirect(data.url);
}

// ============================================================================
// signOut
// ============================================================================
// Détruit la session puis redirige vers /login. Appelé depuis un form action
// pour pouvoir utiliser redirect().
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  // TODO(posthog) : track('user_logged_out').

  redirect("/login");
}

// ============================================================================
// Helpers internes
// ============================================================================

async function touchLastLoginAt(userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    // Non bloquant — on log juste.
    console.error("[auth] touchLastLoginAt failed:", error.message);
  }
}

// Résout l'origine de la requête courante (proto + host) — préfère
// NEXT_PUBLIC_APP_URL en prod, fallback sur l'origine réelle (utile en preview
// Vercel où l'URL change à chaque déploiement).
async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
