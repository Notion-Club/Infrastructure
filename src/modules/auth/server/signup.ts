"use server";

import { signupSchema, type SignupInput } from "@/modules/auth/lib/validation";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";

export type SignupResult =
  | { ok: true }
  | { ok: false; code: "validation" | "already_exists" | "weak_password" | "unknown"; message: string };

// Server Action — Workflow B (non-bloquant) :
// 1. Validation (zod) côté serveur
// 2. supabase.auth.signUp → crée auth.users + déclenche le trigger profiles
// 3. Insert membership Challenge Gratuit via admin client (RLS bypass)
// 4. Le caller (form) redirige vers /dashboard
export async function signUpAction(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { email, password, fullName } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (signUpError) {
    const msg = signUpError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        ok: false,
        code: "already_exists",
        message: "Tu as déjà un compte, va te connecter.",
      };
    }
    if (msg.includes("password")) {
      return { ok: false, code: "weak_password", message: signUpError.message };
    }
    return { ok: false, code: "unknown", message: signUpError.message };
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    return {
      ok: false,
      code: "unknown",
      message: "Réponse Supabase inattendue (pas d'user id).",
    };
  }

  // Création auto de la membership Challenge Gratuit.
  // Le caller utilise le service_role : RLS sur memberships n'autorise
  // pas l'INSERT par l'user lui-même.
  try {
    const admin = createSupabaseAdminClient();

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
      profile_id: userId,
      offer_id: offer.id,
      organization_id: org.id,
      status: "active",
      source: "lp_challenge",
      duration_type: "lifetime",
    });
    if (memErr) {
      throw new Error(`INSERT membership: ${memErr.message}`);
    }
  } catch (err) {
    // L'user est créé (auth.users + profiles via trigger). On log mais on
    // ne fait pas échouer le signup : la membership peut être créée a
    // posteriori par un job de reconciliation.
    console.error("[signup] auto-membership failed:", err);
  }

  // TODO(ticket #9/#10) : envoi email de bienvenue via Resend.
  // TODO(posthog) : track('user_signed_up_challenge', { user_id: userId }).

  return { ok: true };
}
