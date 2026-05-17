import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Tout est inline ici, car le bundler middleware de Vercel a 2 limitations :
//   - en runtime Node.js : il ne bundle PAS les imports, ce qui fait planter
//     Node.js ESM (ERR_MODULE_NOT_FOUND) sur tout import non-extension.
//   - en runtime Edge : l'analyseur de modules rejette tout fichier
//     personnalisé importé qui ne déclare pas explicitement sa compatibilité
//     Edge.
// Solution : runtime Edge (compatible avec @supabase/ssr, qui est conçu pour),
// et zéro fichier custom importé — uniquement des packages npm.

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );

  // IMPORTANT : ne rien exécuter entre createServerClient et getUser,
  // sinon la session peut désynchroniser (cf. doc Supabase SSR).
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques et l'API Next interne.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
