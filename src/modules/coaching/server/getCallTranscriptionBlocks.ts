"use server";

// Server Action lazy-load des blocs Notion d'une page appel coaching, utilisée
// par CallCard au clic "Voir la transcription".
//
// ⚠️ Sécurité (authz) : on ne se contente PAS de fetch les blocs avec l'ID
// donné par le client. Sans vérification, un user authentifié pourrait
// brute-force les UUIDs Notion d'appels d'autres membres (transcription =
// data sensible : tactiques business, finances perso, etc.).
//
// Stratégie : on rappelle `fetchCallsForMember` pour la page Notion Membres
// de l'user courant, et on n'autorise le fetch que si `callPageId` est dans
// la liste retournée. C'est ~1 appel Notion supplémentaire mais ça garantit
// l'isolation. Pas de cache pour V1 (pourra être ajouté si besoin).

import {
  fetchPageBlocks,
  type NotionBlock,
} from "@/shared/lib/notion/blocks";
import { normalizeNotionId } from "@/shared/lib/notion/client";
import { ensureNotionMemberPage } from "./ensureNotionMemberPage";
import { fetchCallsForMember } from "./notion";

export type CallTranscriptionResult =
  | { ok: true; blocks: NotionBlock[] }
  | {
      ok: false;
      reason:
        | "not_authenticated"
        | "no_member_page"
        | "forbidden"
        | "notion_error";
    };

export async function getCallTranscriptionBlocks(
  callPageId: string,
): Promise<CallTranscriptionResult> {
  // 1. Résout (ou matche) la page Notion Membre de l'user courant. Sert aussi
  //    de garde d'authentification (renvoie not_authenticated si pas de user).
  const member = await ensureNotionMemberPage();
  if (!member.ok) return { ok: false, reason: "not_authenticated" };
  if (!member.notionPageId) return { ok: false, reason: "no_member_page" };

  // 2. Authz : on vérifie que callPageId apparaît bien dans les appels de ce
  //    membre. Sans ça, n'importe quel user authentifié peut lire la
  //    transcription d'un autre en devinant un ID Notion.
  const normalizedTarget = normalizeNotionId(callPageId);
  const calls = await fetchCallsForMember(member.notionPageId);
  const isOwned = calls.some((c) => c.notionPageId === normalizedTarget);
  if (!isOwned) {
    console.warn(
      "[getCallTranscriptionBlocks] forbidden access attempt:",
      { user_member_page: member.notionPageId, target: normalizedTarget },
    );
    return { ok: false, reason: "forbidden" };
  }

  // 3. Fetch des blocs. fetchPageBlocks throw en cas d'erreur Notion (token
  //    KO, page archivée, etc.) — on intercepte et on log.
  try {
    const blocks = await fetchPageBlocks(normalizedTarget);
    return { ok: true, blocks: filterNavBlocks(blocks) };
  } catch (err) {
    console.error(
      "[getCallTranscriptionBlocks] fetchPageBlocks failed:",
      err instanceof Error ? err.message : err,
    );
    return { ok: false, reason: "notion_error" };
  }
}

// Les pages d'appels Notion contiennent souvent un bloc de navigation
// "↩ Revenir aux appels" qui pointe vers la DB parente. Il est utile dans
// Notion mais n'a aucun sens dans notre app — on l'enlève des blocs rendus.
// On filtre aussi les dividers solitaires en tête qui sont juste là pour
// séparer cette nav du contenu réel.
function filterNavBlocks(blocks: NotionBlock[]): NotionBlock[] {
  if (blocks.length === 0) return blocks;
  const out = [...blocks];
  // Drop tête : si le 1er bloc est un paragraphe qui contient "Revenir aux
  // appels" (avec ou sans flèche), on l'enlève. Match permissif.
  const first = out[0];
  if (first.type === "paragraph" && first.rich) {
    const text = first.rich
      .map((s) => s.text)
      .join("")
      .toLowerCase();
    if (text.includes("revenir aux appels")) {
      out.shift();
      // Si juste derrière il y a un divider, on l'enlève aussi (séparait nav
      // du contenu).
      if (out[0]?.type === "divider") out.shift();
    }
  }
  return out;
}
