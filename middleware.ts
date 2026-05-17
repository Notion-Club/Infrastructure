import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// IMPORTANT — pourquoi tout est inliné ici, et pas dans un helper @/shared/... :
// Le bundler Vercel pour le middleware Node.js NE bundle PAS les imports
// relatifs ou TS — il pose middleware.js brut et tente de les résoudre à
// runtime, ce qui plante (ERR_MODULE_NOT_FOUND). Inliner garantit que
// seuls les imports npm package (@supabase/ssr, next/server) restent,
// et eux sont correctement résolus depuis node_modules.

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
  // Runtime Node.js (et non Edge) : @supabase/ssr tire indirectement
  // des modules incompatibles Edge sur Vercel (build error sinon).
  runtime: "nodejs",
  matcher: [
    // Tout sauf les assets statiques et l'API Next interne.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
