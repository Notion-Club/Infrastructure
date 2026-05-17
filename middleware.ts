import type { NextRequest } from "next/server";
// Import RELATIF (et non `@/shared/...`) : le bundler de Vercel pour le
// middleware Node.js n'inline pas les alias TS et fait planter le runtime
// avec "Cannot find package '@/shared'". Cf. ERR_MODULE_NOT_FOUND constaté
// sur le déploiement preview de la branche feat/auth-login.
import { updateSupabaseSession } from "./src/shared/lib/supabase/session";

export async function middleware(request: NextRequest) {
  return await updateSupabaseSession(request);
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
