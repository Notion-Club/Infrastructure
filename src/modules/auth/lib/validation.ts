import { z } from "zod";

// Politique mot de passe (Brique 1, décisions actées) : 8 caractères min,
// aucune contrainte de complexité. Doit rester en sync entre signup et login.
const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères");

export const signupSchema = z.object({
  email: z.string().email("Email invalide"),
  password: passwordSchema,
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: z.string().email("Email invalide"),
  // Côté login on ne re-vérifie pas la longueur min ici (l'user existant peut
  // avoir un mdp historique court). La validation se contente du fait qu'il
  // y a quelque chose à envoyer à Supabase.
  password: z.string().min(1, "Mot de passe requis"),
});

export type SigninInput = z.infer<typeof signinSchema>;

// Demande de reset password : juste un email à valider.
export const resetPasswordRequestSchema = z.object({
  email: z.string().email("Email invalide"),
});

export type ResetPasswordRequestInput = z.infer<
  typeof resetPasswordRequestSchema
>;

// Nouveau mdp + confirmation. Les 2 doivent matcher.
export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas",
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

// Reset password — flow lien email. L'user n'a pas son ancien mdp (oublié)
// mais on a un accessToken + refreshToken issus de la session recovery
// établie côté browser via le flow "implicit". On les passe à la Server
// Action pour reconstruire une vraie session Supabase côté serveur
// (setSession), nécessaire pour que `updateUser({password})` fonctionne —
// un simple Bearer header ne suffit pas pour les mutations.
export const recoveryPasswordChangeSchema = z
  .object({
    accessToken: z.string().min(1, "Session recovery requise"),
    refreshToken: z.string().min(1, "Session recovery requise"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas",
  });

export type RecoveryPasswordChangeInput = z.infer<
  typeof recoveryPasswordChangeSchema
>;
