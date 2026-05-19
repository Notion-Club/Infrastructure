"use server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import {
  isPasswordReused,
  recordPasswordInHistory,
  PASSWORD_HISTORY_LIMIT,
} from "@/shared/lib/security/password-history";
import {
  passwordChangeSchema,
  type PasswordChangeInput,
} from "@/modules/settings/lib/validation";

// ============================================================================
// Types de retour
// ============================================================================

export type PasswordChangeResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "validation"
        | "not_authenticated"
        | "no_password_identity"
        | "invalid_current_password"
        | "password_reused"
        | "rate_limited"
        | "weak_password"
        | "unknown";
      message: string;
    };

const PASSWORD_REUSE_MESSAGE = `Ce mot de passe a déjà été utilisé récemment. Choisis-en un différent des ${PASSWORD_HISTORY_LIMIT} derniers.`;

// ============================================================================
// updatePasswordWithReauthAction — changement depuis /settings (user connecté)
// ============================================================================
// Flow :
//   1. Validation zod (current, new, confirm, new ≠ current)
//   2. Récupération de l'user via la session — jamais d'userId depuis le client
//   3. Garde-fou SSO-only (Google sans identité 'email')
//   4. Re-auth via signInWithPassword({ email, currentPassword })
//   5. Check password history (N=5 derniers via bcrypt.compare)
//   6. auth.updateUser({ password: newPassword })
//   7. recordPasswordInHistory(userId, newPassword) — best-effort
export async function updatePasswordWithReauthAction(
  input: PasswordChangeInput,
): Promise<PasswordChangeResult> {
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { currentPassword, newPassword } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour changer ton mot de passe.",
    };
  }

  const hasEmailIdentity = (user.identities ?? []).some(
    (i) => i.provider === "email",
  );
  if (!hasEmailIdentity) {
    return {
      ok: false,
      code: "no_password_identity",
      message:
        "Ce compte n'a pas de mot de passe (connexion via Google uniquement).",
    };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (reauthError) {
    const msg = reauthError.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("too many")) {
      return {
        ok: false,
        code: "rate_limited",
        message: "Trop de tentatives. Réessaie dans quelques minutes.",
      };
    }
    return {
      ok: false,
      code: "invalid_current_password",
      message: "Mot de passe actuel incorrect.",
    };
  }

  try {
    const reused = await isPasswordReused(user.id, newPassword);
    if (reused) {
      return {
        ok: false,
        code: "password_reused",
        message: PASSWORD_REUSE_MESSAGE,
      };
    }
  } catch (err) {
    console.error("[updatePassword] history check failed:", err);
    return {
      ok: false,
      code: "unknown",
      message: "Erreur lors de la vérification du mot de passe.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    const msg = updateError.message.toLowerCase();
    if (msg.includes("password")) {
      return { ok: false, code: "weak_password", message: updateError.message };
    }
    return { ok: false, code: "unknown", message: updateError.message };
  }

  await recordPasswordInHistory(user.id, newPassword);

  return { ok: true };
}
