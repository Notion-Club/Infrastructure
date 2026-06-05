// Lecture des appels coaching d'un membre depuis la DB Notion "Appels de suivi".
//
// ⚠️  Server-only — le token Notion ne doit jamais atteindre le navigateur.
//
// V1 : lecture live à chaque visite /coaching, pas de sync Supabase (la table
// coaching_calls reste pour traçabilité future mais n'est pas peuplée).
//
// Prérequis côté Notion :
//   1. L'intégration "Notion Club⎜Infrastructure" doit être connectée à la DB
//      Appels de suivi (sinon Notion renvoie 404 → on log + retourne []).
//   2. Chaque page appel doit avoir sa propriété Relation Membre pointant vers
//      la page Membre concernée dans la DB Membres.
//
// Best-effort : si l'env var manque ou Notion KO, on retourne [] sans crash.

import {
  notionFetch,
  normalizeNotionId,
  getTitle,
  getRichText,
  getSelect,
  type NotionPage,
} from "@/shared/lib/notion/client";

// ── Schema de la DB Notion Appels de suivi ──────────────────────────────
//
// ⚠️ TODO : valider les noms exacts via GET /databases/{id} une fois la DB
//    connectée à l'intégration. Le bug récurrent : noms en français à accents
//    ou avec apostrophes (ex: "E-mail" et pas "Email", "Résumé" et pas
//    "Resume"). On centralise ici pour pouvoir corriger en un seul endroit.
//
// Sources d'info partielles :
//  - "Membre" est la relation vers DB Membres (159bad05-...). Mais le nom
//    pourrait être "Membres", "Personne", "Lié à" — à vérifier.
//  - "Date" est le champ date de l'appel.
//  - "Statut" select : à valider les options exactes (français).
//  - "Résumé" rich_text : peut être généré par Notion AI.
//  - "URL Fathom" url : lien externe.
//  - Le titre de la page sert de sujet (subject).
const PROP_TITLE = "Nom"; // title — même convention que DB Membres
const PROP_MEMBER = "Membre"; // relation → DB Membres
const PROP_DATE = "Date"; // date
const PROP_HOST = "Coach"; // select (Théo / Noah) — à confirmer
const PROP_STATUS = "Statut"; // select
const PROP_SUMMARY = "Résumé"; // rich_text
const PROP_FATHOM_URL = "URL Fathom"; // url

// Mapping des libellés Notion vers notre enum de statut. On accepte plusieurs
// variantes (FR avec/sans accents, EN) pour être robuste à un renommage léger.
function normalizeStatus(raw: string | null): NotionCallStatus {
  if (!raw) return "upcoming";
  const norm = raw.toLowerCase().replace(/[’'`]/g, "").trim();
  if (norm.startsWith("a venir") || norm.startsWith("à venir")) return "upcoming";
  if (norm.startsWith("accept") || norm.startsWith("effect") || norm.startsWith("fait"))
    return "accepted";
  if (norm.startsWith("no") || norm.startsWith("absent")) return "no_show";
  if (norm.startsWith("annul") || norm.startsWith("cancel")) return "cancelled";
  return "upcoming";
}

// Mapping host : on garde la string telle qu'écrite dans Notion. Le front
// (HOST_PROFILES dans CallCard) saura mapper "Théo"/"Noah" vers les initiales.
// Tout autre host tombe sur un fallback gris (cf. CallCard).

export type NotionCallStatus =
  | "upcoming"
  | "accepted"
  | "no_show"
  | "cancelled";

export interface NotionCoachingCall {
  notionPageId: string; // = id de la page Notion (clé pour fetch transcription)
  scheduledAt: string; // ISO ; "" si pas de date renseignée dans Notion
  host: string; // nom brut côté Notion (mappé côté UI)
  subject: string; // = title de la page
  status: NotionCallStatus;
  aiSummary: string | null;
  fathomUrl: string | null;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

// ── Helpers de propriétés non encore exposés par client.ts ──────────────
function getDateStart(page: NotionPage, prop: string): string {
  // L'API Notion renvoie { date: { start: "2026-05-15T14:00:00Z", end: null } }
  // mais NotionPropertyValue dans client.ts ne déclare pas `date`. On lit en
  // raw pour éviter de toucher au type partagé.
  const raw = (page.properties[prop] as unknown as {
    date?: { start?: string | null } | null;
  })?.date;
  return raw?.start ?? "";
}

function getUrl(page: NotionPage, prop: string): string | null {
  return (page.properties[prop] as unknown as { url?: string | null })?.url ?? null;
}

// ── Conversion d'une page Notion vers notre type ────────────────────────
function toNotionCoachingCall(page: NotionPage): NotionCoachingCall {
  const summary = getRichText(page, PROP_SUMMARY).trim();
  const fathom = getUrl(page, PROP_FATHOM_URL);
  return {
    notionPageId: normalizeNotionId(page.id),
    scheduledAt: getDateStart(page, PROP_DATE),
    host: getSelect(page, PROP_HOST) ?? "",
    subject: getTitle(page, PROP_TITLE) || "Coaching",
    status: normalizeStatus(getSelect(page, PROP_STATUS)),
    aiSummary: summary.length > 0 ? summary : null,
    fathomUrl: fathom && fathom.length > 0 ? fathom : null,
  };
}

// Renvoie tous les appels Notion liés à un membre, triés par date décroissante
// côté Notion (le plus récent en premier).
//
// Best-effort : retourne [] si la DB n'est pas configurée ou si Notion répond
// en erreur — l'UI dégrade en "aucun appel" plutôt que de crasher.
export async function fetchCallsForMember(
  notionMemberPageId: string,
): Promise<NotionCoachingCall[]> {
  const databaseId = process.env.NOTION_CALLS_DATABASE_ID;
  if (!databaseId) return [];

  try {
    const calls: NotionCoachingCall[] = [];
    let cursor: string | null = null;

    do {
      const data: NotionQueryResponse = await notionFetch<NotionQueryResponse>(
        `/databases/${normalizeNotionId(databaseId)}/query`,
        {
          method: "POST",
          body: {
            filter: {
              property: PROP_MEMBER,
              relation: { contains: notionMemberPageId },
            },
            sorts: [{ property: PROP_DATE, direction: "descending" }],
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {}),
          },
        },
      );

      for (const page of data.results) {
        if (page.archived || page.in_trash) continue;
        calls.push(toNotionCoachingCall(page));
      }
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    return calls;
  } catch (err) {
    console.error(
      "[fetchCallsForMember] failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
