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
  type NotionPage,
  type NotionPropertyValue,
} from "@/shared/lib/notion/client";

// ── Schema de la DB Notion "Appel de Suivi" ─────────────────────────────
// Vérifié via GET /databases/{id} le 2026-06-06.
//
// Particularités à noter :
//  - Le titre s'appelle "Name" et NON "Nom" (vs la DB Membres qui utilise
//    "Nom"). Incohérence côté Notion mais on s'aligne sur le réel.
//  - "Host" est de type `people` (Notion User), pas `select`. On lit
//    le premier user et on prend son name.
//  - "Status" est de type Notion `status` (pas `select`). Les options
//    sont {"Accepté", "Refusé", "No-show"} — pas d'option "À venir".
//    Un appel à venir = status vide/null (on infère côté code).
//  - "Résumé IA" (rich_text) est le champ qu'on lit pour le résumé court.
//    Le contenu de la page (blocs Notion) sert de transcription complète,
//    rendue inline via NotionBlocks au clic "Voir la transcription".
const PROP_TITLE = "Name"; // title
const PROP_MEMBER = "Membre"; // relation → DB Membres
const PROP_DATE = "Date"; // date
const PROP_HOST = "Host"; // people (Notion user) — first user wins
const PROP_STATUS = "Status"; // status (NOT select) — Accepté/Refusé/No-show
const PROP_SUMMARY = "Résumé IA"; // rich_text
const PROP_FATHOM_URL = "URL Fathom"; // url
const PROP_OBJECT = "Objet de la Demande"; // rich_text — affiché dans la pill modale
const PROP_RESCHEDULE_URL = "Reschedule URL"; // url — bouton "Replanifier ou annuler"

// Mapping des libellés Notion vers notre enum de statut.
//
// Important : "À venir" n'est PAS une option dans Notion. Un appel sans
// statut renseigné est considéré upcoming si sa date est future, sinon
// cancelled (admin a oublié de le passer en accepted/no_show, on l'archive
// proprement). Ce dernier cas est traité dans `getCallsForCurrentUser`,
// pas ici — on retourne "upcoming" par défaut quand status est null.
function normalizeStatus(raw: string | null): NotionCallStatus {
  if (!raw) return "upcoming"; // status vide → à venir (filtré par date plus tard)
  const norm = raw.toLowerCase().replace(/[’'`]/g, "").trim();
  if (norm.startsWith("a venir") || norm.startsWith("à venir")) return "upcoming";
  if (norm.startsWith("accept") || norm.startsWith("effect") || norm.startsWith("fait"))
    return "accepted";
  if (norm.startsWith("refus")) return "cancelled"; // option "Refusé" Notion
  if (norm.startsWith("no") || norm.startsWith("absent")) return "no_show";
  if (norm.startsWith("annul") || norm.startsWith("cancel")) return "cancelled";
  return "upcoming";
}

export type NotionCallStatus =
  | "upcoming"
  | "accepted"
  | "no_show"
  | "cancelled";

export interface NotionCoachingCall {
  notionPageId: string; // = id de la page Notion (clé pour fetch transcription)
  scheduledAt: string; // ISO ; "" si pas de date renseignée dans Notion
  host: string; // nom brut côté Notion (mappé côté UI)
  hostAvatarUrl: string | null; // photo de profil Notion du Host (people)
  subject: string; // = title de la page
  status: NotionCallStatus;
  aiSummary: string | null;
  fathomUrl: string | null;
  objectRequest: string | null; // "Objet de la Demande" — pitch saisi par le membre
  rescheduleUrl: string | null; // lien Fillout / TidyCal pour replanifier ou annuler
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

// ── Helpers de propriétés non encore exposés par client.ts ──────────────
//
// Plutôt qu'étendre NotionPropertyValue dans client.ts (qui sert plusieurs
// modules), on lit les types manquants en local via des extractors typés.
type PropWithDate = NotionPropertyValue & {
  date?: { start?: string | null } | null;
};
type PropWithStatusObj = NotionPropertyValue & {
  status?: { name: string } | null;
};
type PropWithPeople = NotionPropertyValue & {
  people?: Array<{
    name?: string | null;
    avatar_url?: string | null;
  }>;
};

function getDateStart(page: NotionPage, prop: string): string {
  return (page.properties[prop] as PropWithDate | undefined)?.date?.start ?? "";
}

function getStatusName(page: NotionPage, prop: string): string | null {
  return (
    (page.properties[prop] as PropWithStatusObj | undefined)?.status?.name ?? null
  );
}

function getFirstPersonName(page: NotionPage, prop: string): string | null {
  const people = (page.properties[prop] as PropWithPeople | undefined)?.people;
  return people?.[0]?.name ?? null;
}

function getFirstPersonAvatarUrl(
  page: NotionPage,
  prop: string,
): string | null {
  const people = (page.properties[prop] as PropWithPeople | undefined)?.people;
  return people?.[0]?.avatar_url ?? null;
}

function getUrl(page: NotionPage, prop: string): string | null {
  return page.properties[prop]?.url ?? null;
}

// ── Conversion d'une page Notion vers notre type ────────────────────────
function toNotionCoachingCall(page: NotionPage): NotionCoachingCall {
  const summary = getRichText(page, PROP_SUMMARY).trim();
  const fathom = getUrl(page, PROP_FATHOM_URL);
  const object = getRichText(page, PROP_OBJECT).trim();
  const reschedule = getUrl(page, PROP_RESCHEDULE_URL);
  return {
    notionPageId: normalizeNotionId(page.id),
    scheduledAt: getDateStart(page, PROP_DATE),
    host: getFirstPersonName(page, PROP_HOST) ?? "",
    hostAvatarUrl: getFirstPersonAvatarUrl(page, PROP_HOST),
    subject: getTitle(page, PROP_TITLE) || "Coaching",
    status: normalizeStatus(getStatusName(page, PROP_STATUS)),
    aiSummary: summary.length > 0 ? summary : null,
    fathomUrl: fathom && fathom.length > 0 ? fathom : null,
    objectRequest: object.length > 0 ? object : null,
    rescheduleUrl: reschedule && reschedule.length > 0 ? reschedule : null,
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
