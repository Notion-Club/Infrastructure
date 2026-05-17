import { createClient } from "@supabase/supabase-js";

// Client Supabase BYPASS RLS via la service_role key.
// ⚠️  À n'utiliser QUE côté serveur (Server Action, Route Handler, cron).
//     Ne JAMAIS importer ce fichier depuis un Client Component.
//     La service_role key permet de lire/écrire toutes les tables sans RLS.
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante. Cf. .env.example.",
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
