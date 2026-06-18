import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

// Vérifie que la requête provient d'un ADMINISTRATEUR authentifié (session
// Supabase + profiles.role = 'admin').
//
// Utilisé pour fermer les routes API d'administration — notamment celles du
// widget de feedback qui écrivent/lisent/suppriment dans la base Notion
// roadmap via le token privilégié partagé. Avant ce garde, ces routes étaient
// TOTALEMENT ouvertes (cf. audit sécurité : un anonyme pouvait archiver
// n'importe quelle page Notion, lire le backlog interne, spammer la base).
export async function isRequestAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  return profile?.role === "admin";
}
