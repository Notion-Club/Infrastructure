import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";

// Route appelée quand l'utilisateur clique le lien de confirmation reçu par email.
// Le token (UUID) est passé en query string. Si trouvé en DB :
//   - set profiles.email_verified_at = now()
//   - efface le token (one-shot)
//   - redirect /dashboard?email_verified=success
// Sinon (token absent, déjà utilisé ou inconnu) :
//   - redirect /dashboard?email_verified=invalid
//
// On utilise le client admin (service_role) car la route est publique :
// l'utilisateur ne sera pas forcément déjà connecté au moment du clic
// (il peut ouvrir le mail sur un autre device).
//
// Sécurité : le token est un UUID v4 (~122 bits aléatoires), donc non
// devinable par bruteforce. Il est effacé après usage pour éviter le replay.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${origin}/dashboard?email_verified=invalid`);
  }

  const supabase = createSupabaseAdminClient();

  // Lookup du profile par token
  const { data: profile, error: lookupError } = await supabase
    .from("profiles")
    .select("id, email_verified_at")
    .eq("email_verification_token", token)
    .maybeSingle();

  if (lookupError) {
    console.error("[verify-email] lookup error:", lookupError.message);
    return NextResponse.redirect(`${origin}/dashboard?email_verified=invalid`);
  }

  if (!profile) {
    // Token inconnu ou déjà consommé.
    return NextResponse.redirect(`${origin}/dashboard?email_verified=invalid`);
  }

  if (profile.email_verified_at) {
    // Déjà vérifié — le lien est valide mais redondant. On considère que
    // c'est un succès du point de vue de l'utilisateur.
    return NextResponse.redirect(`${origin}/dashboard?email_verified=success`);
  }

  // Marque vérifié + efface le token (one-shot).
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      email_verified_at: new Date().toISOString(),
      email_verification_token: null,
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("[verify-email] update error:", updateError.message);
    return NextResponse.redirect(`${origin}/dashboard?email_verified=invalid`);
  }

  return NextResponse.redirect(`${origin}/dashboard?email_verified=success`);
}
