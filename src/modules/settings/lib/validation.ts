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

export const profileUpdateSchema = z.object({
  display_name: displayName,
  first_name: personName,
  last_name: personName,
  phone: phoneField,
  notion_email: optionalEmail,
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

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
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export type AvatarMimeType = (typeof AVATAR_ALLOWED_MIME)[number];

export function isAllowedAvatarMime(mime: string): mime is AvatarMimeType {
  return (AVATAR_ALLOWED_MIME as readonly string[]).includes(mime);
}
