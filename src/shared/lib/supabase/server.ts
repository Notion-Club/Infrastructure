import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase pour Server Components, Server Actions, Route Handlers.
// Respecte la session de l'user via les cookies. RLS s'applique avec l'anon key.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : on ne peut pas écrire de
            // cookies. La session sera rafraîchie par le middleware.
          }
        },
      },
    },
  );
}
