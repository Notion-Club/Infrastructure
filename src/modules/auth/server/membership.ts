import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";

// Crée la membership Challenge Gratuit pour un user si et seulement si
// il n'a aucune membership active existante. Idempotent : safe à appeler
// plusieurs fois (signup form + callback OAuth couvrent les 2 chemins de
// création d'un nouveau user).
//
// Pré-requis : la ligne profile correspondante doit déjà exister (créée
// par le trigger handle_new_user sur auth.users).
//
// Utilise le service_role : RLS sur memberships interdit l'INSERT par
// l'user lui-même.
export async function ensureChallengeMembership(
  profileId: string,
  source: "lp_challenge" | "oauth_google" | "admin_invite" | "migration_slack",
): Promise<void> {
  const admin = createSupabaseAdminClient();

  // Court-circuit si l'user a déjà au moins une membership active
  // (cas : user signup email puis login Google avec même email,
  //  ou retry du signup côté caller).
  const { data: existing, error: existingErr } = await admin
    .from("memberships")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    throw new Error(`Lookup memberships existantes: ${existingErr.message}`);
  }
  if (existing) {
    return;
  }

  const { data: offer, error: offerErr } = await admin
    .from("offers")
    .select("id")
    .eq("slug", "challenge-gratuit")
    .single();
  if (offerErr || !offer) {
    throw new Error(`Offer challenge-gratuit introuvable: ${offerErr?.message}`);
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "notion-club")
    .single();
  if (orgErr || !org) {
    throw new Error(`Organisation notion-club introuvable: ${orgErr?.message}`);
  }

  const { error: memErr } = await admin.from("memberships").insert({
    profile_id: profileId,
    offer_id: offer.id,
    organization_id: org.id,
    status: "active",
    source,
    duration_type: "lifetime",
  });
  if (memErr) {
    throw new Error(`INSERT membership: ${memErr.message}`);
  }
}
