import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Tout est inline ici : le bundler middleware de Vercel a des limitations
// qui rendent fragiles les imports custom (cf. PR OPS-15). Ici on n'importe
// que des packages npm Edge-safe.

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Garde-fou : si les env vars Supabase manquent, on log et on laisse
  // passer la requête. Bloquer ici ferait crasher le site entier (sur
  // toutes les routes, y compris /login) en cas de mauvaise config.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[middleware] env vars Supabase manquantes — refresh session skip.",
      {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
      },
    );
    return NextResponse.next({ request });
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // IMPORTANT : ne rien exécuter entre createServerClient et getUser,
    // sinon la session peut désynchroniser (cf. doc Supabase SSR).
    await supabase.auth.getUser();

    return supabaseResponse;
  } catch (err) {
    // On capture pour ne pas casser le site sur 100% des routes.
    // Visible dans Vercel → Runtime Logs.
    console.error("[middleware] refresh session failed:", err);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques et l'API Next interne.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
