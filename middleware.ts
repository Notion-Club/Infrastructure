import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/shared/lib/supabase/session";

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
