// Queries serveur onboarding — check de complétion et lecture du profile.
//
// L'unique source de vérité pour "onboarding complété" est la colonne
// profiles.onboarding_completed_at (migration 033). Si NULL → à compléter.
// Le helper isOnboardingComplete encapsule ce check pour qu'aucun consommateur
// (notamment le redirect du layout côté Théo) n'ait à connaître le schéma.

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

// Renvoie true si le user courant a complété l'onboarding (ou s'il n'est
// pas authentifié — dans ce cas le redirect /login s'occupera de lui).
// false UNIQUEMENT si user authentifié + profile existant + completed_at NULL.
//
// Pattern d'usage côté Théo (layout (app)) :
//   if (!(await isOnboardingComplete()) && pathname !== '/onboarding') {
//     redirect('/onboarding');
//   }
export async function isOnboardingComplete(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return true; // pas notre problème — middleware/redirect login

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle<{ onboarding_completed_at: string | null }>();

  if (error) {
    console.error("[onboarding/queries] isOnboardingComplete query failed:", error.message);
    // En cas de doute on laisse passer — éviter de boucler en redirect.
    return true;
  }

  if (!data) return true; // profile pas encore créé par le trigger, laisser passer

  return data.onboarding_completed_at !== null;
}

// Lecture du profile onboarding pour pré-remplir le form (édition ultérieure).
export interface OnboardingProfile {
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  objectives: string[] | null;
  isComplete: boolean;
}

export async function getOnboardingProfile(): Promise<OnboardingProfile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url, objectives, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle<{
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      objectives: string[] | null;
      onboarding_completed_at: string | null;
    }>();

  if (error) {
    console.error("[onboarding/queries] getOnboardingProfile failed:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    firstName: data.first_name,
    lastName: data.last_name,
    avatarUrl: data.avatar_url,
    objectives: data.objectives,
    isComplete: data.onboarding_completed_at !== null,
  };
}
