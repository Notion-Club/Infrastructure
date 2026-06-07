"use server";

// Server Action appelée au clic "Réserver un coaching" sur /coaching.
// Garantit que l'user authentifié a une page Notion Membres associée, et
// renvoie les infos nécessaires pour pré-remplir Fillout (id, mail, prenom, nom).
//
// ⚠️ Décision (2026-06-06) : l'`id` envoyé à Fillout est l'**UUID Supabase**
//    (profiles.id), PAS le notion_member_page_id. C'est l'UUID Supabase qui
//    sert de clé universelle dans tout l'écosystème. Côté Fillout, le
//    RecordPicker filtre sur la colonne "UUID Supabase" de la DB Notion
//    Membres pour pré-sélectionner le bon record.
//
//    Le notion_member_page_id reste stocké en DB pour la traçabilité et pour
//    permettre PATCH la bonne page Notion lors de la réconciliation, mais
//    il n'est pas envoyé au browser.
//
// 3 cas gérés :
//   A. Cache hit : profiles.notion_member_page_id est déjà rempli → retour direct.
//   B. Ancien membre Notion : findNotionMemberByEmail trouve une page existante
//      par email (créée à la main par Théo avant la plateforme) → on écrit l'UUID
//      Supabase dans la page Notion + on remplit profiles.notion_member_page_id.
//      Pas de doublon Notion.
//   C. Vraie création : aucune page Notion trouvée → createNotionMember + persist.
//
// Best-effort : si Notion est down ou pas configuré (NOTION_MEMBERS_DATABASE_ID
// absent), on retourne quand même supabaseUuid pour que Fillout ait au moins
// l'identification (et qu'il puisse essayer le match côté Notion plus tard).

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";
import {
  createNotionMember,
  findNotionMemberByEmail,
  updateNotionMemberUuid,
} from "@/shared/lib/notion/write";

export type EnsureNotionMemberResult =
  | {
      ok: true;
      supabaseUuid: string;          // = profiles.id, clé universelle envoyée à Fillout
      notionPageId: string | null;   // = traçabilité interne (pas envoyée au browser)
      firstName: string | null;
      lastName: string | null;
      email: string;
    }
  | { ok: false; reason: "not_authenticated" | "profile_not_found" };

export async function ensureNotionMemberPage(): Promise<EnsureNotionMemberResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { ok: false, reason: "not_authenticated" };
  }

  // Lecture du profile (RLS profiles_select_self autorise self-read).
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, notion_member_page_id")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      notion_member_page_id: string | null;
    }>();

  if (profileErr || !profile) {
    console.error(
      "[ensureNotionMemberPage] profile read failed:",
      profileErr?.message,
    );
    return { ok: false, reason: "profile_not_found" };
  }

  // ── Cas A : cache hit ───────────────────────────────────────────────
  if (profile.notion_member_page_id) {
    return {
      ok: true,
      supabaseUuid: profile.id,
      notionPageId: profile.notion_member_page_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: user.email,
    };
  }

  // ── Cas B et C : pas encore liée — on cherche puis on crée si absent ─
  const admin = createSupabaseAdminClient();
  let notionPageId: string | null = null;

  const found = await findNotionMemberByEmail(user.email);
  if (found) {
    // Cas B — ancien membre Notion. On écrit l'UUID Supabase dedans (si pas
    // déjà présent — idempotence en cas de relance) puis on remplit profiles.
    if (found.currentUuid !== profile.id) {
      await updateNotionMemberUuid(found.pageId, profile.id);
      // Best-effort : si le PATCH échoue, on garde quand même le pageId pour
      // la prochaine tentative.
    }
    notionPageId = found.pageId;
  } else {
    // Cas C — vraie création.
    notionPageId = await createNotionMember({
      uuid: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: user.email,
    });
  }

  // Persiste le notion_member_page_id dans profiles. Guard `is null` pour
  // l'idempotence : si un autre appel concurrent a déjà rempli, on n'écrase pas.
  if (notionPageId) {
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ notion_member_page_id: notionPageId })
      .eq("id", profile.id)
      .is("notion_member_page_id", null);
    if (updateErr) {
      console.error(
        "[ensureNotionMemberPage] persist notion_member_page_id failed:",
        updateErr.message,
      );
    }
  }

  return {
    ok: true,
    supabaseUuid: profile.id,
    notionPageId,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: user.email,
  };
}
