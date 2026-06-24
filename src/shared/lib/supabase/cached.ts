import { cache } from "react";

import { createSupabaseServerClient } from "./server";

// Helpers d'authentification mémoïsés à l'échelle d'UNE requête (React
// `cache()`). Plusieurs Server Components / queries d'un même rendu (layout
// + page + widgets) appelaient chacun `supabase.auth.getUser()` et relisaient
// le profil — soit ~4 allers-retours réseau redondants vers Supabase Auth +
// DB par chargement de page. `cache()` garantit un seul appel partagé : tout
// consommateur d'un même rendu reçoit le résultat mémoïsé.
//
// Important : `cache()` est scoping PAR requête (jamais cross-request), donc
// aucune fuite de session entre utilisateurs.

// `getUser()` valide le JWT côté serveur Supabase Auth → c'est un appel
// réseau, pas une lecture locale. Un seul par requête grâce au cache.
export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getAuthUserId = cache(async (): Promise<string | null> => {
  const user = await getAuthUser();
  return user?.id ?? null;
});

export interface CurrentProfile {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  role: string | null;
}

// Profil de l'utilisateur courant — superset des colonnes lues par le layout
// (identity) et la page dashboard (greeting). Mémoïsé pour éviter la double
// lecture de la table `profiles` au même rendu.
export const getCurrentProfile = cache(
  async (): Promise<CurrentProfile | null> => {
    const userId = await getAuthUserId();
    if (!userId) return null;
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select(
        "first_name, last_name, display_name, username, avatar_url, avatar_color, role",
      )
      .eq("id", userId)
      .maybeSingle<CurrentProfile>();
    return data ?? null;
  },
);
