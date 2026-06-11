import { z } from "zod";

// Politique mot de passe alignée avec `@/modules/auth/lib/validation` :
// 8 caractères min, aucune contrainte de complexité.
const PASSWORD_MIN_LENGTH = 8;

const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères`);

// Changement de mot de passe depuis /settings — l'user connaît son mdp actuel.
// On re-vérifie obligatoirement l'ancien mdp côté serveur avant de muter
// la session, sinon n'importe qui ayant une session active (cookie volé,
// session laissée ouverte sur un poste partagé) pourrait changer le mdp.
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas",
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "Le nouveau mot de passe doit être différent de l'ancien",
  });

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

// ============================================================================
// Profile update — édition depuis /settings (section Profile)
// ============================================================================
// Tous les champs sont optionnels nullables. On normalise les strings vides
// en null côté serveur pour éviter d'écrire "" en DB (qui poserait des
// problèmes pour les UNIQUE ou les checks "is set" plus tard).

const trimmedOrNull = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v.length === 0 ? null : v))
  .nullable();

const displayName = trimmedOrNull.pipe(
  z
    .string()
    .max(60, "60 caractères maximum")
    .nullable(),
);

const personName = trimmedOrNull.pipe(
  z
    .string()
    .max(40, "40 caractères maximum")
    .nullable(),
);

// Phone : on accepte le format produit par `formatPhone()` ("+33 6 12 34 …")
// ou null. Validation simple : commence par "+" suivi de chiffres/espaces si
// non vide. La saisie est déjà filtrée côté client par PhoneField.
const phoneField = trimmedOrNull.pipe(
  z
    .string()
    .regex(/^\+[\d\s-]{4,30}$/, "Format de téléphone invalide")
    .nullable(),
);

const optionalEmail = trimmedOrNull.pipe(
  z.string().email("Email invalide").nullable(),
);

// Username : 3-30 chars, ASCII lowercase + chiffres + - _, ne pas
// commencer/finir par - ou _. OBLIGATOIRE (auto-généré au signup, doit
// rester rempli ensuite). Case-insensitive côté DB via index unique.
const USERNAME_REGEX = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;
const usernameField = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(3, "3 caractères minimum")
      .max(30, "30 caractères maximum")
      .regex(
        USERNAME_REGEX,
        "Lettres minuscules, chiffres, - et _ uniquement. Ne peut pas commencer ou finir par - ou _.",
      ),
  );

const bioField = trimmedOrNull.pipe(
  z.string().max(500, "500 caractères maximum").nullable(),
);

// OPS-47 — l'edit du nom d'affichage se fait désormais en inline depuis
// ProfileHero, séparément du gros submit du formulaire. On accepte donc
// des partial updates côté serveur (chaque champ devient optionnel).
// Supabase ignore les clés undefined dans .update(), donc seul ce qu'on
// envoie explicitement est touché.
export const profileUpdateSchema = z.object({
  display_name: displayName.optional(),
  first_name: personName.optional(),
  last_name: personName.optional(),
  username: usernameField.optional(),
  bio: bioField.optional(),
  phone: phoneField.optional(),
  notion_email: optionalEmail.optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// Limites exportées pour l'UI (compteur de caractères, helper text, etc.)
export const BIO_MAX_LENGTH = 500;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

// ============================================================================
// Account email change — section Profile (champ "Email Notion Club")
// ============================================================================
// Séparé de profileUpdate parce que ça déclenche un email de confirmation
// Supabase (l'user doit cliquer un lien) — flow et UX différents.
export const accountEmailChangeSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email invalide"),
});

export type AccountEmailChangeInput = z.infer<typeof accountEmailChangeSchema>;

// ============================================================================
// Avatar upload — validation MIME + taille
// ============================================================================
// Le file lui-même n'est pas validé via zod (zod ne checkpas File/FormData) ;
// on exporte les contraintes pour que client + serveur les utilisent.
// 25 MB — Théo a demandé une marge confortable (OPS-36) pour que les
// utilisateurs puissent uploader des photos smartphone non-compressées
// (HEIC export iPhone fait facilement 4-6 MB, photos HD 8-15 MB). Aligné
// avec la limite file_size_limit du bucket avatars (mig. 031).
export const AVATAR_MAX_BYTES = 25 * 1024 * 1024;
export const AVATAR_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export type AvatarMimeType = (typeof AVATAR_ALLOWED_MIME)[number];

export function isAllowedAvatarMime(mime: string): mime is AvatarMimeType {
  return (AVATAR_ALLOWED_MIME as readonly string[]).includes(mime);
}

// ============================================================================
// Avatar color — palette stricte
// ============================================================================
// Source unique de vérité pour les couleurs autorisées. Toute couleur en
// dehors de cette liste est rejetée par updateAvatarColorAction (évite
// qu'un user injecte n'importe quel HEX via DevTools).
//
// Couleurs choisies pour bien contraster sur fond blanc avec du texte
// blanc (initiales) — accessibilité WCAG AA visée.
export const AVATAR_COLOR_PALETTE = [
  "#e0625a", // brand Notion Club (rouge)
  "#5b8def", // bleu
  "#8a6cf2", // violet
  "#27ae8e", // vert
  "#ed9d3a", // orange
  "#c97c97", // rose
  "#52525b", // gris foncé
  "#0f172a", // noir bleuté
] as const;

export type AvatarColor = (typeof AVATAR_COLOR_PALETTE)[number];

export const DEFAULT_AVATAR_COLOR: AvatarColor = "#e0625a";

export function isAllowedAvatarColor(value: string): value is AvatarColor {
  return (AVATAR_COLOR_PALETTE as readonly string[]).includes(value);
}

export const avatarColorChangeSchema = z.object({
  color: z
    .string()
    .refine((v) => isAllowedAvatarColor(v), {
      message: "Couleur non autorisée.",
    }),
});

export type AvatarColorChangeInput = z.infer<typeof avatarColorChangeSchema>;

// ============================================================================
// Account deletion — Danger Zone (soft delete / anonymisation)
// ============================================================================
// Friction délibérée : double confirmation pour éviter tout clic
// accidentel ou session-hijack.
//   1. Password — re-auth (cf. OPS-17 pattern password change)
//   2. confirmation textuelle stricte — l'user doit RÉ-ÉCRIRE la phrase
export const ACCOUNT_DELETION_CONFIRMATION_PHRASE = "SUPPRIMER MON COMPTE";

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Mot de passe requis"),
  confirmation: z
    .string()
    .refine((v) => v === ACCOUNT_DELETION_CONFIRMATION_PHRASE, {
      message: `Tape exactement "${ACCOUNT_DELETION_CONFIRMATION_PHRASE}" pour confirmer.`,
    }),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

// ============================================================================
// Notifications — matrice catégorie × canal + toggle global par canal
// ============================================================================
// Source de vérité partagée entre le composant client et les Server Actions
// pour les valeurs autorisées. Les `check` côté DB (migrations 004 + 012)
// imposent les mêmes ensembles.

export const NOTIFICATION_CATEGORIES = [
  "new_modules",
  "formation_reminders",
  "coaching_calls",
  "community_messages",
  "billing",
] as const;

export const NOTIFICATION_CHANNELS = [
  "email",
  "in_app",
  "whatsapp",
  "push",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// Défaut implicite quand aucune ligne n'existe en DB (cf. migrations 004 + 012)
export const DEFAULT_CHANNEL_ENABLED: Record<NotificationChannel, boolean> = {
  email: true,
  in_app: true,
  whatsapp: false,
  // Push : off par défaut. L'utilisateur doit explicitement accepter la
  // permission navigateur via le toggle dans Réglages — pas de souscription
  // silencieuse au signup.
  push: false,
};

const notificationPreferenceRow = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES),
  channel: z.enum(NOTIFICATION_CHANNELS),
  enabled: z.boolean(),
});

const channelPreferenceRow = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  enabled: z.boolean(),
});

// Update unifié : on envoie d'un coup la matrice fine + les toggles globaux.
// Limite stricte sur la taille pour éviter qu'un client malicieux n'envoie un
// payload énorme (5 cats × 3 channels = 15 lignes max ; 3 canaux).
export const notificationSettingsUpdateSchema = z.object({
  preferences: z.array(notificationPreferenceRow).max(15),
  channels: z.array(channelPreferenceRow).max(3),
});

export type NotificationSettingsUpdateInput = z.infer<
  typeof notificationSettingsUpdateSchema
>;
