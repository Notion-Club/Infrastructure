// Helper serveur pour récupérer toutes les capabilities d'un user en un seul
// appel via la RPC get_user_capabilities (migration 032).
//
// Usage typique :
//   - ProfileIdentityProvider (layout (app)) → hydrate le contexte avec les caps.
//   - Pages serveur ressources → check ponctuel pour gating server-side.
//
// Pas de cache ici : la fonction Postgres est STABLE donc déjà rapide,
// et la durée de vie d'un Server Component rend tout cache plus complexe
// que bénéfique.

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import {
  DEFAULT_USER_CAPABILITIES,
  type Capability,
  type UserCapabilities,
} from "@/shared/types/capabilities";

// Récupère les capabilities du user courant (auth.uid()). Retourne tout false
// si non authentifié ou erreur (jamais throw — best-effort serveur).
export async function getCurrentUserCapabilities(): Promise<UserCapabilities> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...DEFAULT_USER_CAPABILITIES };
  return getUserCapabilitiesById(user.id);
}

// Récupère les capabilities d'un user précis. Réservé aux contextes où on
// connaît déjà l'user_id (ex: layout qui a déjà fait getUser()).
//
// Note : la RPC rejette si appelée pour un autre user que soi sans être admin.
// Donc appeler avec userId != auth.uid() depuis un Server Component classique
// échouera silencieusement et retournera tout false.
export async function getUserCapabilitiesById(
  userId: string,
): Promise<UserCapabilities> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_user_capabilities", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[getUserCapabilitiesById] RPC failed:", error.message);
    return { ...DEFAULT_USER_CAPABILITIES };
  }

  if (!data || typeof data !== "object") {
    return { ...DEFAULT_USER_CAPABILITIES };
  }

  // Le RPC retourne un jsonb mappé en object par supabase-js. On force la
  // forme attendue avec un fallback sur le default pour chaque clé manquante.
  const raw = data as Partial<Record<Capability, unknown>>;
  return {
    can_access_challenge_program: raw.can_access_challenge_program === true,
    can_access_paid_programs: raw.can_access_paid_programs === true,
    can_message_admins: raw.can_message_admins === true,
    can_view_community: raw.can_view_community === true,
    can_view_paid_content: raw.can_view_paid_content === true,
    can_book_calls: raw.can_book_calls === true,
    can_view_call_summaries: raw.can_view_call_summaries === true,
    can_access_templates_library: raw.can_access_templates_library === true,
  };
}
