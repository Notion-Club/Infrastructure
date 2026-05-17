import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { ensureChallengeMembership } from "@/modules/auth/server/membership";

// Route appelée par Google après autorisation OAuth. Échange le code court
// contre une session, puis garantit qu'une membership Challenge Gratuit
// existe pour le user (cas premier login Google = nouveau user).
//
// Sécurité :
// - On utilise l'origine réelle de la requête (pas une env var) pour
//   construire l'URL de redirect finale — empêche un attaquant d'envoyer
//   un user authentifié vers un domaine externe.
// - En cas d'erreur d'exchange, on renvoie vers /login avec un flag.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_no_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`);
  }

  // Premier login Google = trigger handle_new_user vient de créer le profile
  // mais aucune membership n'existe encore → on l'ajoute.
  // Idempotent : ne fait rien si l'user a déjà une membership.
  try {
    await ensureChallengeMembership(data.user.id, "oauth_google");
  } catch (err) {
    console.error("[auth/callback] ensureChallengeMembership failed:", err);
  }

  // last_login_at update (best-effort, non bloquant).
  await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  // TODO(posthog) : track('user_logged_in', { method: 'google', user_id }).

  return NextResponse.redirect(`${origin}/dashboard`);
}
