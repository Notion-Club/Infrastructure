import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/shared/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSupabaseSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques et l'API Next interne.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
