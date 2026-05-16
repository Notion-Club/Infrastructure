import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit faire au moins 8 caractères"),
  fullName: z.string().trim().min(0).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
