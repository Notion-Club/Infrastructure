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
