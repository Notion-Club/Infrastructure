import { NextResponse, type NextRequest } from "next/server";

// DIAGNOSTIC : middleware pass-through, zéro logique.
// Objectif : isoler si le 500 vient de notre code Supabase ou
// d'une autre cause (Vercel platform, matcher, etc.).
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
