"use server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";
import { createNotionMember } from "@/shared/lib/notion/write";
import {
  onboardingProfileSchema,
  type OnboardingProfileInput,
} from "@/modules/onboarding/lib/validation";

const AVATARS_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB — aligné sur settings
const AVATAR_ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;

export type OnboardingResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "validation"
        | "not_authenticated"
        | "invalid_mime"
        | "file_too_large"
        | "upload_failed"
        | "unknown";
      message: string;
    };

// Server Action consommée par la page /onboarding (que Théo cablera).
//
// Flow :
//   1. Auth via session (jamais d'userId client).
//   2. Validation zod du payload textuel.
//   3. Upload avatar best-effort (si fourni) → bucket avatars/<userId>/.
//   4. Update profiles : first_name, last_name, avatar_url, objectives,
//      onboarding_completed_at = now().
//   5. Best-effort : créer la page Notion Membres si pas déjà fait (cas du
//      signup Google où on n'avait pas firstName/lastName complets, ou si
//      le signup a foiré l'étape Notion).
//
// Le formData attendu :
//   - firstName: string
//   - lastName: string
//   - objectives: string (séparé par "|" — convention simple front/back)
//   - avatar: File (optionnel)
export async function updateOnboardingProfileAction(
  formData: FormData,
): Promise<OnboardingResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu dois être connecté pour compléter ton profil.",
    };
  }

  const rawObjectives = formData.get("objectives");
  const objectivesArr =
    typeof rawObjectives === "string" && rawObjectives.length > 0
      ? rawObjectives.split("|").map((s) => s.trim()).filter(Boolean)
      : [];

  const firstNameRaw = formData.get("firstName");
  const lastNameRaw = formData.get("lastName");
  const parsed = onboardingProfileSchema.safeParse({
    firstName: typeof firstNameRaw === "string" ? firstNameRaw : "",
    lastName: typeof lastNameRaw === "string" ? lastNameRaw : "",
    objectives: objectivesArr.length > 0 ? objectivesArr : undefined,
  } satisfies Partial<OnboardingProfileInput>);

  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { firstName, lastName, objectives } = parsed.data;

  // ── Upload avatar (optionnel) ──
  let avatarUrl: string | null = null;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (!(AVATAR_ALLOWED_MIME as readonly string[]).includes(avatar.type)) {
      return {
        ok: false,
        code: "invalid_mime",
        message: `Format non supporté. Utilise ${AVATAR_ALLOWED_MIME.join(", ")}.`,
      };
    }
    if (avatar.size > AVATAR_MAX_BYTES) {
      return {
        ok: false,
        code: "file_too_large",
        message: `Le fichier dépasse ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)} MB.`,
      };
    }
    const ext = extensionForMime(avatar.type);
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, avatar, {
        contentType: avatar.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadErr) {
      console.error("[onboarding] avatar upload failed:", uploadErr.message);
      return {
        ok: false,
        code: "upload_failed",
        message: "Impossible d'envoyer la photo. Réessaie.",
      };
    }
    avatarUrl = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // ── Update profiles ──
  const updates: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    onboarding_completed_at: new Date().toISOString(),
  };
  if (objectives !== undefined) updates.objectives = objectives;
  if (avatarUrl !== null) updates.avatar_url = avatarUrl;

  const { error: updateErr } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (updateErr) {
    console.error("[onboarding] profile update failed:", updateErr.message);
    return { ok: false, code: "unknown", message: updateErr.message };
  }

  // ── Best-effort Notion Membres si pas déjà créé au signup ──
  // (cas Google OAuth, ou signup ayant raté l'étape Notion).
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("notion_member_page_id")
    .eq("id", user.id)
    .maybeSingle<{ notion_member_page_id: string | null }>();

  if (profile && !profile.notion_member_page_id) {
    try {
      const notionPageId = await createNotionMember({
        uuid: user.id,
        firstName,
        lastName,
        email: user.email,
      });
      if (notionPageId) {
        await admin
          .from("profiles")
          .update({ notion_member_page_id: notionPageId })
          .eq("id", user.id)
          .is("notion_member_page_id", null);
      }
    } catch (err) {
      console.error("[onboarding] createNotionMember failed:", err);
    }
  }

  return { ok: true };
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    default:
      return "jpg";
  }
}
