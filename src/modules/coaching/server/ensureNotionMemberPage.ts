"use server";

// Server Action appelée au clic "Réserver un coaching" sur /coaching.
// Garantit que l'user authentifié a une page Notion Membres associée, et
// renvoie les infos nécessaires pour pré-remplir Fillout (id, mail, prenom, nom).
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
// absent), on retourne pageId=null mais ok=true — l'UI dégrade en ouvrant
// Fillout sans préfile plutôt que de bloquer le user.

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
      pageId: string | null;
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
      pageId: profile.notion_member_page_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: user.email,
    };
  }

  // ── Cas B et C : pas encore liée — on cherche puis on crée si absent ─
  const admin = createSupabaseAdminClient();
  let pageId: string | null = null;

  const found = await findNotionMemberByEmail(user.email);
  if (found) {
    // Cas B — ancien membre Notion. On écrit l'UUID Supabase dedans (si pas
    // déjà présent — idempotence en cas de relance) puis on remplit profiles.
    if (found.currentUuid !== profile.id) {
      const updated = await updateNotionMemberUuid(found.pageId, profile.id);
      if (!updated) {
        // Best-effort : on garde le pageId pour le retour même si le PATCH a
        // échoué. La prochaine tentative re-tentera l'update.
      }
    }
    pageId = found.pageId;
  } else {
    // Cas C — vraie création.
    pageId = await createNotionMember({
      uuid: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: user.email,
    });
  }

  // Persiste le pageId dans profiles si on en a un. Guard `is null` pour
  // l'idempotence : si un autre appel concurrent a déjà rempli, on n'écrase pas.
  if (pageId) {
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ notion_member_page_id: pageId })
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
    pageId,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: user.email,
  };
}
