import { z } from "zod";

// Politique mot de passe (Brique 1, décisions actées) : 8 caractères min,
// aucune contrainte de complexité. Doit rester en sync entre signup et login.
const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères");

export const signupSchema = z.object({
  email: z.string().email("Email invalide"),
  password: passwordSchema,
  fullName: z.string().trim().min(0).optional(),
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
