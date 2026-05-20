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
  DEFAULT_CHANNEL_ENABLED,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  accountEmailChangeSchema,
  avatarColorChangeSchema,
  deleteAccountSchema,
  isAllowedAvatarMime,
  notificationSettingsUpdateSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  type AccountEmailChangeInput,
  type AvatarColorChangeInput,
  type DeleteAccountInput,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationSettingsUpdateInput,
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
      code: "validation" | "not_authenticated" | "username_taken" | "unknown";
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

export type AvatarColorChangeResult =
  | { ok: true }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "unknown";
      message: string;
    };

export type AvatarRemoveResult =
  | { ok: true }
  | {
      ok: false;
      code: "not_authenticated" | "unknown";
      message: string;
    };

export type DeleteAccountResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "validation"
        | "not_authenticated"
        | "no_password_identity"
        | "invalid_password"
        | "rate_limited"
        | "already_deleted"
        | "unknown";
      message: string;
    };

export type NotificationSettings = {
  preferences: Record<
    NotificationCategory,
    Record<NotificationChannel, boolean>
  >;
  channels: Record<NotificationChannel, boolean>;
};

export type NotificationSettingsResult =
  | { ok: true }
  | {
      ok: false;
      code: "validation" | "not_authenticated" | "unknown";
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
    // Postgres unique_violation = 23505. Notre index unique case-insensitive
    // sur lower(username) déclenche cette erreur quand un autre user a déjà
    // ce username (cf. migration 010).
    if (error.code === "23505" && error.message.toLowerCase().includes("username")) {
      return {
        ok: false,
        code: "username_taken",
        message: "Ce nom d'utilisateur est déjà pris. Choisis-en un autre.",
      };
    }
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

// ============================================================================
// updateAvatarColorAction — choix d'une couleur de fond d'avatar
// ============================================================================
// Couleur HEX d'une palette autorisée (cf. AVATAR_COLOR_PALETTE). On valide
// strictement côté serveur pour empêcher l'injection d'un HEX arbitraire
// via DevTools.
export async function updateAvatarColorAction(
  input: AvatarColorChangeInput,
): Promise<AvatarColorChangeResult> {
  const parsed = avatarColorChangeSchema.safeParse(input);
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
      message: "Tu dois être connecté pour modifier ton avatar.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_color: parsed.data.color })
    .eq("id", user.id);
  if (error) {
    console.error("[updateAvatarColor] failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }
  return { ok: true };
}

// ============================================================================
// removeAvatarAction — supprime la photo d'avatar (garde la couleur)
// ============================================================================
// Set avatar_url = null + cleanup du bucket storage du user.
export async function removeAvatarAction(): Promise<AvatarRemoveResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour supprimer ta photo.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (error) {
    console.error("[removeAvatar] profile update failed:", error.message);
    return { ok: false, code: "unknown", message: error.message };
  }

  // Cleanup storage best-effort
  try {
    const admin = createSupabaseAdminClient();
    const { data: files } = await admin.storage
      .from(AVATARS_BUCKET)
      .list(user.id, { limit: 100 });
    if (files && files.length > 0) {
      await admin.storage
        .from(AVATARS_BUCKET)
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }
  } catch (err) {
    console.error("[removeAvatar] storage cleanup failed:", err);
  }

  return { ok: true };
}

// ============================================================================
// deleteAccountAction — soft-delete (anonymisation) du compte courant
// ============================================================================
// Flow :
//   1. Validation zod (password + confirmation phrase exacte)
//   2. Récupère l'user via la session (jamais d'userId depuis le client)
//   3. Re-auth via signInWithPassword({ email, password })
//      → garde-fou contre session-hijack
//   4. Cleanup storage : remove tous les fichiers de avatars/<userId>/
//   5. RPC anonymize_account(userId) via service-role
//      → nullifie PII profile, swap email auth, supprime identities,
//        cleanup password_history
//   6. signOut() de la session courante
//   7. Le caller redirige vers /login?account_deleted=1
//
// Sécurité :
//   - L'identité provient TOUJOURS de la session, jamais du payload client
//   - Re-auth password obligatoire (cf. raisons OPS-17 password change)
//   - La fonction anonymize_account est REVOKE EXECUTE de authenticated,
//     seul le service-role peut l'appeler
//
// Note : le hard delete final (DELETE auth.users) sera fait par un cron à
// 30j dans une PR ultérieure (Brique 3 admin). Pour l'instant, soft delete
// suffit côté RGPD : toutes les PII sont nullifiées immédiatement.
export async function deleteAccountAction(
  input: DeleteAccountInput,
): Promise<DeleteAccountResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { password } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour supprimer ton compte.",
    };
  }

  const hasEmailIdentity = (user.identities ?? []).some(
    (i) => i.provider === "email",
  );
  if (!hasEmailIdentity) {
    // SSO-only : pas de password à vérifier. On refuse pour le moment —
    // un flow alternatif (re-auth Google) sera ajouté plus tard si besoin.
    return {
      ok: false,
      code: "no_password_identity",
      message:
        "Suppression impossible pour les comptes Google uniquement. Contacte le support.",
    };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
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
      code: "invalid_password",
      message: "Mot de passe incorrect.",
    };
  }

  const admin = createSupabaseAdminClient();

  // 1. Cleanup storage — best-effort, on continue même si ça échoue
  try {
    const { data: files } = await admin.storage
      .from(AVATARS_BUCKET)
      .list(user.id, { limit: 100 });
    if (files && files.length > 0) {
      await admin.storage
        .from(AVATARS_BUCKET)
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }
  } catch (err) {
    console.error("[deleteAccount] storage cleanup failed:", err);
  }

  // 2. RPC d'anonymisation atomique
  const { error: rpcError } = await admin.rpc("anonymize_account", {
    target_user_id: user.id,
  });
  if (rpcError) {
    if (rpcError.message?.includes("account_already_deleted")) {
      return {
        ok: false,
        code: "already_deleted",
        message: "Ce compte a déjà été supprimé.",
      };
    }
    console.error("[deleteAccount] anonymize_account failed:", rpcError);
    return {
      ok: false,
      code: "unknown",
      message: "Impossible de supprimer le compte. Réessaie.",
    };
  }

  // 3. SignOut de la session courante — le JWT reste techniquement valide
  //    jusqu'à expiration mais l'user n'a plus de credentials pour login.
  await supabase.auth.signOut();

  return { ok: true };
}

// ============================================================================
// getNotificationSettings — lecture initiale (Server Component)
// ============================================================================
// Charge la matrice catégorie × canal + les toggles globaux par canal pour
// l'user courant. Mergé avec les defaults pour qu'il y ait toujours une
// valeur définie pour chaque (category, channel) et chaque channel global.
//
// Renvoie null si pas d'user (cas mock dev / pré-auth) — le caller doit alors
// tomber sur ses defaults côté client.
export async function getNotificationSettings(): Promise<NotificationSettings | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [prefsRes, channelsRes] = await Promise.all([
    supabase
      .from("notification_preferences")
      .select("category, channel, enabled")
      .eq("user_id", user.id),
    supabase
      .from("channel_preferences")
      .select("channel, enabled")
      .eq("user_id", user.id),
  ]);

  if (prefsRes.error) {
    console.error("[getNotificationSettings] prefs read failed:", prefsRes.error.message);
  }
  if (channelsRes.error) {
    console.error("[getNotificationSettings] channels read failed:", channelsRes.error.message);
  }

  // Defaults : pour la matrice, on suit la même règle que les canaux globaux
  // (email/in_app on, whatsapp off) — cohérent avec le défaut DB des inserts
  // futurs et avec l'UI actuelle.
  const preferences = NOTIFICATION_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = { ...DEFAULT_CHANNEL_ENABLED };
      return acc;
    },
    {} as NotificationSettings["preferences"],
  );

  for (const row of prefsRes.data ?? []) {
    const cat = row.category as NotificationCategory;
    const ch = row.channel as NotificationChannel;
    if (preferences[cat] && ch in preferences[cat]) {
      preferences[cat][ch] = row.enabled;
    }
  }

  const channels: Record<NotificationChannel, boolean> = { ...DEFAULT_CHANNEL_ENABLED };
  for (const row of channelsRes.data ?? []) {
    const ch = row.channel as NotificationChannel;
    if (ch in channels) channels[ch] = row.enabled;
  }

  return { preferences, channels };
}

// ============================================================================
// updateNotificationSettingsAction — persistance matrice + canaux
// ============================================================================
// Upsert atomique (best-effort : 2 requêtes en parallèle) sur les deux tables.
// L'auth provient TOUJOURS de la session côté serveur — on ignore tout user_id
// éventuellement présent dans le payload client.
//
// RLS notif_prefs_*_self + channel_prefs_*_self (migrations 004 + 012)
// garantit qu'on ne peut écrire que sur ses propres lignes même si on bidouille.
export async function updateNotificationSettingsAction(
  input: NotificationSettingsUpdateInput,
): Promise<NotificationSettingsResult> {
  const parsed = notificationSettingsUpdateSchema.safeParse(input);
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
      message: "Tu dois être connecté pour modifier tes préférences.",
    };
  }

  const prefRows = parsed.data.preferences.map((p) => ({
    user_id: user.id,
    category: p.category,
    channel: p.channel,
    enabled: p.enabled,
  }));

  const channelRows = parsed.data.channels.map((c) => ({
    user_id: user.id,
    channel: c.channel,
    enabled: c.enabled,
  }));

  const [prefsRes, channelsRes] = await Promise.all([
    prefRows.length > 0
      ? supabase
          .from("notification_preferences")
          .upsert(prefRows, { onConflict: "user_id,category,channel" })
      : Promise.resolve({ error: null } as const),
    channelRows.length > 0
      ? supabase
          .from("channel_preferences")
          .upsert(channelRows, { onConflict: "user_id,channel" })
      : Promise.resolve({ error: null } as const),
  ]);

  if (prefsRes.error || channelsRes.error) {
    const err = prefsRes.error ?? channelsRes.error;
    console.error("[updateNotificationSettings] failed:", err?.message);
    return {
      ok: false,
      code: "unknown",
      message: err?.message ?? "Erreur lors de l'enregistrement.",
    };
  }

  return { ok: true };
}
