import bcrypt from "bcryptjs";

import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";

// Politique de password history (OWASP recommandé : N=5).
// On bloque la réutilisation des N derniers mdp pour empêcher le scénario
// trivial "je rebascule entre A et B" qui contourne le check single-step.
export const PASSWORD_HISTORY_LIMIT = 5;

const BCRYPT_COST = 10;

// Vérifie si le candidat `plainPassword` matche l'un des N derniers hashes
// de l'user. Retourne true si réutilisation détectée.
//
// Note : bypass RLS via service-role client — la table password_history a
// DENY ALL pour les rôles authentifiés.
export async function isPasswordReused(
  userId: string,
  plainPassword: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("password_history")
    .select("password_hash")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PASSWORD_HISTORY_LIMIT);

  if (error) {
    // En cas d'erreur, on log et on refuse de continuer : mieux vaut bloquer
    // un change légitime qu'autoriser une réutilisation silencieuse.
    console.error("[password-history] read failed:", error.message);
    throw new Error("Impossible de vérifier l'historique des mots de passe.");
  }

  if (!data || data.length === 0) return false;

  for (const row of data) {
    const matches = await bcrypt.compare(plainPassword, row.password_hash);
    if (matches) return true;
  }
  return false;
}

// Enregistre le nouveau hash dans l'historique + trim les anciennes lignes
// au-delà de PASSWORD_HISTORY_LIMIT (pour pas que la table grossisse).
//
// Best-effort : si l'INSERT échoue, on log mais on ne throw pas — le mdp
// a déjà été mis à jour côté Supabase Auth, l'user ne doit pas être bloqué
// par notre table interne. Conséquence : ce mdp ne sera pas bloqué à la
// prochaine vérif, ce qui est dégradé mais acceptable.
export async function recordPasswordInHistory(
  userId: string,
  plainPassword: string,
): Promise<void> {
  try {
    const hash = await bcrypt.hash(plainPassword, BCRYPT_COST);
    const supabase = createSupabaseAdminClient();

    const { error: insertError } = await supabase
      .from("password_history")
      .insert({ user_id: userId, password_hash: hash });
    if (insertError) {
      console.error(
        "[password-history] insert failed:",
        insertError.message,
      );
      return;
    }

    // Trim : récupérer les IDs au-delà de la limite et les supprimer.
    // On garde toujours PASSWORD_HISTORY_LIMIT lignes max par user.
    const { data: keep, error: keepError } = await supabase
      .from("password_history")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(PASSWORD_HISTORY_LIMIT);

    if (keepError || !keep) return;
    const keepIds = keep.map((row) => row.id);
    if (keepIds.length === 0) return;

    const { error: deleteError } = await supabase
      .from("password_history")
      .delete()
      .eq("user_id", userId)
      .not("id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);
    if (deleteError) {
      console.error("[password-history] trim failed:", deleteError.message);
    }
  } catch (err) {
    console.error("[password-history] record failed:", err);
  }
}
