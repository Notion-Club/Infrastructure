"use server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";
import {
  isPasswordReused,
  recordPasswordInHistory,
  PASSWORD_HISTORY_LIMIT,
} from "@/shared/lib/security/password-history";
import {
  AVATAR_ALLOWED_MIME,
  AVATAR_MAX_BYTES,
  accountEmailChangeSchema,
  isAllowedAvatarMime,
  passwordChangeSchema,
  profileUpdateSchema,
  type AccountEmailChangeInput,
  type PasswordChangeInput,
  type ProfileUpdateInput,
} from "@/modules/settings/lib/validation";

const AVATARS_BUCKET = "avatars";

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

export type ProfileUpdateResult =
  | { ok: true }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "unknown";
      message: string;
    };

export type AccountEmailChangeResult =
  | { ok: true; pendingConfirmation: true }
  | {
      ok: false;
      code:
        | "validation"
        | "not_authenticated"
        | "same_as_current"
        | "email_taken"
        | "rate_limited"
        | "unknown";
      message: string;
    };

export type AvatarUploadResult =
  | { ok: true; publicUrl: string }
  | {
      ok: false;
      code:
        | "no_file"
        | "invalid_mime"
        | "file_too_large"
        | "not_authenticated"
        | "upload_failed"
        | "unknown";
      message: string;
    };

const PASSWORD_REUSE_MESSAGE = `Ce mot de passe a déjà été utilisé récemment. Choisis-en un différent des ${PASSWORD_HISTORY_LIMIT} derniers.`;

// ============================================================================
// updatePasswordWithReauthAction — changement depuis /settings (user connecté)
// ============================================================================
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

// ============================================================================
// updateProfileAction — édition du profile depuis /settings
// ============================================================================
// Champs édités : display_name, first_name, last_name, phone, notion_email.
// L'email auth (login) est géré séparément via updateAccountEmailAction.
//
// Sécurité :
//   - User récupéré via la session côté serveur, jamais via un id client
//   - Validation zod côté serveur (le client envoie n'importe quoi sinon)
//   - L'UPDATE passe par le client serveur normal (anon key + JWT user) :
//     la policy RLS `profiles_update_self` n'autorise que `where id = auth.uid()`
//     donc inutile d'utiliser le service-role ici.
export async function updateProfileAction(
  input: ProfileUpdateInput,
): Promise<ProfileUpdateResult> {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour modifier ton profil.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id);

  if (error) {
    console.error("[updateProfile] failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }

  return { ok: true };
}

// ============================================================================
// updateAccountEmailAction — changement de l'email de login
// ============================================================================
// Supabase envoie un email de confirmation à la nouvelle adresse. La bascule
// n'est effective qu'après clic sur le lien (sur app.notionclub.fr/auth/...).
// On retourne pendingConfirmation: true pour que le caller affiche le bon
// message à l'user ("un email de confirmation a été envoyé").
export async function updateAccountEmailAction(
  input: AccountEmailChangeInput,
): Promise<AccountEmailChangeResult> {
  const parsed = accountEmailChangeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { newEmail } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour modifier ton email.",
    };
  }

  if (user.email && user.email.toLowerCase() === newEmail) {
    return {
      ok: false,
      code: "same_as_current",
      message: "Cet email est déjà ton email actuel.",
    };
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("taken")) {
      return {
        ok: false,
        code: "email_taken",
        message: "Cet email est déjà utilisé par un autre compte.",
      };
    }
    if (msg.includes("rate limit") || msg.includes("too many")) {
      return {
        ok: false,
        code: "rate_limited",
        message: "Trop de tentatives. Réessaie dans quelques minutes.",
      };
    }
    return { ok: false, code: "unknown", message: error.message };
  }

  return { ok: true, pendingConfirmation: true };
}

// ============================================================================
// uploadAvatarAction — upload + cleanup de l'ancien avatar
// ============================================================================
// 1. Récupère l'user via la session (jamais d'userId client-side)
// 2. Valide MIME (png/jpeg/webp) et taille (max 2 MB) côté serveur
// 3. Upload dans avatars/<userId>/<timestamp>.<ext>
// 4. Update profiles.avatar_url avec la public URL
// 5. Cleanup : delete tous les autres fichiers de avatars/<userId>/ pour
//    éviter les orphans (sinon chaque upload laisse un fichier zombie qui
//    grossit le bucket indéfiniment).
//
// Note : on utilise le service-role pour le cleanup parce qu'on veut lister +
// supprimer en bypass des éventuels delais de cache RLS sur storage.objects.
// L'upload lui-même passe par le client user (RLS storage l'autorise dans
// son propre dossier).
export async function uploadAvatarAction(
  formData: FormData,
): Promise<AvatarUploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      code: "no_file",
      message: "Aucun fichier reçu.",
    };
  }

  if (!isAllowedAvatarMime(file.type)) {
    return {
      ok: false,
      code: "invalid_mime",
      message: `Format non supporté. Utilise ${AVATAR_ALLOWED_MIME.join(", ")}.`,
    };
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: `Le fichier dépasse ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)} MB.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour modifier ta photo.",
    };
  }

  const ext = extensionForMime(file.type);
  const filename = `${Date.now()}.${ext}`;
  const path = `${user.id}/${filename}`;

  // Upload via client user — la policy storage.avatars_insert_own l'autorise
  // dans le dossier <user_id>/.
  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) {
    console.error("[uploadAvatar] storage upload failed:", uploadError.message);
    return {
      ok: false,
      code: "upload_failed",
      message: "Impossible d'envoyer la photo. Réessaie.",
    };
  }

  const { data: urlData } = supabase.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);
  if (profileError) {
    console.error(
      "[uploadAvatar] profile update failed:",
      profileError.message,
    );
    // L'upload a réussi mais le profile n'est pas à jour : best-effort de
    // delete le fichier orphelin pour pas polluer le bucket.
    await supabase.storage.from(AVATARS_BUCKET).remove([path]).catch(() => {});
    return {
      ok: false,
      code: "unknown",
      message: "Photo envoyée mais profil non mis à jour. Réessaie.",
    };
  }

  // Cleanup : delete les autres fichiers de ce user. Best-effort, on ne
  // bloque pas si ça échoue (l'avatar courant est déjà actif).
  await cleanupOldAvatars(user.id, filename).catch((err) => {
    console.error("[uploadAvatar] cleanup failed:", err);
  });

  return { ok: true, publicUrl };
}

// ============================================================================
// Helpers internes
// ============================================================================

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    default:
      return "jpg";
  }
}

async function cleanupOldAvatars(
  userId: string,
  keepFilename: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(AVATARS_BUCKET)
    .list(userId, { limit: 100 });
  if (error || !data) return;

  const toRemove = data
    .filter((f) => f.name !== keepFilename)
    .map((f) => `${userId}/${f.name}`);
  if (toRemove.length === 0) return;

  await admin.storage.from(AVATARS_BUCKET).remove(toRemove);
}
