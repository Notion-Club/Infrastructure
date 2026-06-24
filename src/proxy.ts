import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Proxy Next 16 (ex-middleware) — rafraîchit la session Supabase à chaque
// requête de navigation.
//
// CONTEXTE : le client serveur (createSupabaseServerClient) ne peut pas écrire
// de cookies depuis un Server Component (le setAll y est entouré d'un catch
// vide). Sans rafraîchissement centralisé, chaque getUser() côté layout devait
// renégocier le refresh token à chaud, ce qui rallongeait le cold start de la
// PWA. Le proxy écrit ici les cookies rafraîchis sur la réponse → le layout
// lit ensuite un access token valide sans aller-retour de refresh.
//
// POURQUOI MAINTENANT (le middleware avait été retiré) : en Next 16, le proxy
// tourne sur le runtime **Node.js par défaut** (le `runtime` n'est même plus
// configurable). Le bug historique `__dirname` + runtime Edge qui avait forcé
// la suppression du middleware ne s'applique donc plus.
//
// On NE met PAS de redirection d'auth ici : la doc Next déconseille d'utiliser
// le proxy comme solution d'autorisation complète. La protection des routes
// reste dans (app)/layout.tsx (redirect /login). Le proxy ne fait QUE
// rafraîchir le cookie de session (pas de data fetching lourd).

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Reflète les cookies rafraîchis sur la requête (pour la suite du
          // pipeline) ET sur la réponse (pour le navigateur).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Déclenche le rafraîchissement du token si nécessaire. Le résultat n'est
  // pas utilisé ici — l'effet voulu est l'écriture des cookies via setAll.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Exclut les assets statiques, l'optimiseur d'images, les routes API, le
  // service worker, le manifest, les icônes/splash et les fichiers d'assets :
  // le refresh de session n'a de sens que sur les navigations de pages.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons|splash|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|otf|ttf|woff|woff2)$).*)",
  ],
};
