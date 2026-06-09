// Sync d'une membership Supabase depuis l'état d'une page Notion Membres.
//
// Cas d'usage : le webhook /api/notion-webhooks/members appelle
// syncMembershipFromNotion() quand l'admin modifie la propriété Offre ou
// Date de fin d'un membre côté Notion.
//
// Logique :
//   1. On résout le profil Supabase via la page Notion (lookup
//      profiles.notion_member_page_id).
//   2. On résout l'offer Supabase via la valeur de la propriété Offre Notion.
//   3. On compare avec la membership active actuelle :
//      - Identique → no-op (idempotence).
//      - Différente → expire l'ancienne + crée la nouvelle.
//      - Date de fin changée → update expires_at.
//   4. On log dans membership_changes pour traçabilité.
//
// Tout passe par le service_role (RLS bloque l'INSERT membership côté user).

import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";

// Mapping de la valeur de la propriété `Offre` côté Notion vers le slug de
// l'offre côté Supabase. Toute valeur non listée → log + no-op.
//
// Pourquoi ne pas mettre ça côté DB ? Parce que c'est un mapping "contrat
// frontend" qui peut changer au gré de Théo dans Notion (ajout d'une nouvelle
// formule, renommage). Mieux vaut le garder en code typé qu'en table éditable.
const NOTION_OFFER_TO_SLUG: Record<string, string> = {
  "Formation uniquement": "formation-uniquement",
  Accompagnement: "accompagnement-120-jours",
};

// Mapping vers le duration_type Supabase. Aligné sur les valeurs autorisées
// par le check constraint de la table memberships.
const NOTION_OFFER_TO_DURATION: Record<
  string,
  "lifetime" | "days_120" | "no_accompaniment"
> = {
  "Formation uniquement": "lifetime",
  Accompagnement: "days_120",
};

export type SyncResult =
  | { kind: "no_profile_found"; notionPageId: string }
  | { kind: "unknown_offer"; offer: string }
  | { kind: "no_change"; offerSlug: string }
  | {
      kind: "created";
      offerSlug: string;
      previousOfferSlug: string | null;
    }
  | { kind: "expires_at_updated"; offerSlug: string };

export interface SyncInput {
  notionMemberPageId: string;
  // Valeur exacte de la propriété Offre côté Notion ("Formation uniquement",
  // "Accompagnement", ou null si l'admin a vidé le champ).
  offre: string | null;
  // Valeur de Date de fin (formule Notion). ISO date ou null.
  dateDeFin: string | null;
}

export async function syncMembershipFromNotion(
  input: SyncInput,
): Promise<SyncResult> {
  const admin = createSupabaseAdminClient();

  // ── 1. Lookup profile via notion_member_page_id ─────────────────────────
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("notion_member_page_id", input.notionMemberPageId)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (profileErr) {
    throw new Error(`Lookup profile par notion page: ${profileErr.message}`);
  }
  if (!profile) {
    // Notion peut envoyer un événement sur un membre dont la page n'a jamais
    // été liée à un profile Supabase (ex: ancien membre Notion pre-app, ou
    // user invité par mail mais qui n'a pas encore signup). On log et on
    // ignore — le matching se fera au premier ensureNotionMemberPage du user.
    return { kind: "no_profile_found", notionPageId: input.notionMemberPageId };
  }

  // ── 2. Résolution de l'offre depuis la valeur Notion ────────────────────
  if (!input.offre) {
    // Admin a vidé le champ Offre côté Notion → on ne touche pas la membership
    // existante. Si Théo veut révoquer une membership, il doit le faire
    // explicitement (autre mécanisme à venir).
    return { kind: "no_change", offerSlug: "" };
  }

  const offerSlug = NOTION_OFFER_TO_SLUG[input.offre];
  if (!offerSlug) {
    return { kind: "unknown_offer", offer: input.offre };
  }

  const { data: offer, error: offerErr } = await admin
    .from("offers")
    .select("id")
    .eq("slug", offerSlug)
    .single<{ id: string }>();

  if (offerErr || !offer) {
    throw new Error(`Offer ${offerSlug} introuvable: ${offerErr?.message}`);
  }

  // ── 3. Lookup membership active actuelle ────────────────────────────────
  const { data: activeMembership, error: memErr } = await admin
    .from("memberships")
    .select("id, offer_id, expires_at, duration_type")
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      offer_id: string;
      expires_at: string | null;
      duration_type: string | null;
    }>();

  if (memErr) {
    throw new Error(`Lookup membership active: ${memErr.message}`);
  }

  const newExpiresAt = input.dateDeFin ? new Date(input.dateDeFin).toISOString() : null;
  const newDurationType = NOTION_OFFER_TO_DURATION[input.offre];

  // ── 4. Cas A : membership identique, juste expires_at à jour ────────────
  if (activeMembership && activeMembership.offer_id === offer.id) {
    if (activeMembership.expires_at === newExpiresAt) {
      return { kind: "no_change", offerSlug };
    }
    // Update expires_at uniquement
    const { error: updateErr } = await admin
      .from("memberships")
      .update({
        expires_at: newExpiresAt,
        duration_type: newDurationType,
      })
      .eq("id", activeMembership.id);
    if (updateErr) {
      throw new Error(`Update membership expires_at: ${updateErr.message}`);
    }
    await admin.from("membership_changes").insert({
      membership_id: activeMembership.id,
      profile_id: profile.id,
      change_type: "extended",
      old_expires_at: activeMembership.expires_at,
      new_expires_at: newExpiresAt,
      reason: "sync_notion: Date de fin updated",
    });
    return { kind: "expires_at_updated", offerSlug };
  }

  // ── 5. Cas B : nouvelle offre — on expire l'ancienne (si présente)
  //              + on crée la nouvelle ─────────────────────────────────────
  let previousOfferSlug: string | null = null;

  if (activeMembership) {
    const { data: prevOffer } = await admin
      .from("offers")
      .select("slug")
      .eq("id", activeMembership.offer_id)
      .maybeSingle<{ slug: string }>();
    previousOfferSlug = prevOffer?.slug ?? null;

    const { error: expireErr } = await admin
      .from("memberships")
      .update({ status: "expired" })
      .eq("id", activeMembership.id);
    if (expireErr) {
      throw new Error(`Expire ancienne membership: ${expireErr.message}`);
    }
    await admin.from("membership_changes").insert({
      membership_id: activeMembership.id,
      profile_id: profile.id,
      change_type: "expired",
      old_status: "active",
      new_status: "expired",
      reason: `sync_notion: switched to ${offerSlug}`,
    });
  }

  // INSERT nouvelle membership
  const { data: newMembership, error: insertErr } = await admin
    .from("memberships")
    .insert({
      profile_id: profile.id,
      offer_id: offer.id,
      organization_id: profile.organization_id,
      status: "active",
      source: "sync_notion",
      duration_type: newDurationType,
      expires_at: newExpiresAt,
      external_ref: input.notionMemberPageId,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !newMembership) {
    throw new Error(`Insert nouvelle membership: ${insertErr?.message}`);
  }

  await admin.from("membership_changes").insert({
    membership_id: newMembership.id,
    profile_id: profile.id,
    change_type: "created",
    new_status: "active",
    new_expires_at: newExpiresAt,
    reason: `sync_notion: offre Notion = ${input.offre}`,
  });

  return { kind: "created", offerSlug, previousOfferSlug };
}
