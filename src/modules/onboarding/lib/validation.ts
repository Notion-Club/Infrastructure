import { z } from "zod";

// Politique : firstName / lastName obligatoires (déjà collectés au signup,
// mais re-validés à l'onboarding pour le cas Google OAuth où ils peuvent
// arriver vides ou approximatifs). objectives optionnel (tableau de strings
// libres, max 10 entrées de 80 chars chacune pour éviter l'abus).
//
// L'avatar est géré séparément côté Server Action (FormData / File), pas
// dans ce schéma (zod ne valide pas les File proprement côté serveur).

const trimmedNonEmpty = (label: string, max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(1, `${label} requis`)
        .max(max, `${max} caractères maximum`),
    );

export const onboardingProfileSchema = z.object({
  firstName: trimmedNonEmpty("Prénom", 40),
  lastName: trimmedNonEmpty("Nom", 40),
  objectives: z
    .array(z.string().trim().min(1).max(80, "80 caractères maximum"))
    .max(10, "10 objectifs maximum")
    .optional(),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
