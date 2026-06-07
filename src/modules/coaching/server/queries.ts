// Queries serveur coaching — lecture des appels coaching de l'user.
// La RLS coaching_calls_select_self_or_admin filtre déjà côté DB, donc
// l'user n'accède jamais qu'à ses propres appels (ou tous s'il est admin).
//
// V1 — Note d'architecture : la lecture des appels affichée dans /coaching
// passe désormais par `getCallsForCurrentUser` qui lit directement Notion
// (DB Appels de suivi) via `fetchCallsForMember`. Les fonctions
// `getUpcomingCalls` / `getPastCalls` ci-dessous restent en place pour la
// rétrocompatibilité et la future sync Notion → Supabase, mais ne sont plus
// utilisées par la page /coaching.

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { signTranscriptToken } from "@/shared/lib/transcriptToken";
import { getOrigin } from "@/shared/lib/origin";
import { ensureNotionMemberPage } from "./ensureNotionMemberPage";
import {
  fetchCallsForMember,
  type NotionCallStatus,
} from "./notion";

export type CoachingCallStatus =
  | "upcoming"
  | "accepted"
  | "no_show"
  | "cancelled";

export interface CoachingCall {
  id: string;
  scheduledAt: string; // ISO
  host: string;
  subject: string | null;
  status: CoachingCallStatus;
  aiSummary: string | null;
}

type CoachingCallRow = {
  id: string;
  scheduled_at: string;
  host: string;
  subject: string | null;
  status: CoachingCallStatus;
  ai_summary: string | null;
};

function rowToCall(row: CoachingCallRow): CoachingCall {
  return {
    id: row.id,
    scheduledAt: row.scheduled_at,
    host: row.host,
    subject: row.subject,
    status: row.status,
    aiSummary: row.ai_summary,
  };
}

// Renvoie les appels à venir (status = upcoming, scheduled_at >= now).
// Triés par date croissante (le plus proche en premier).
export async function getUpcomingCalls(): Promise<CoachingCall[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("coaching_calls")
    .select("id, scheduled_at, host, subject, status, ai_summary")
    .eq("profile_id", user.id)
    .eq("status", "upcoming")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("[coaching/queries] getUpcomingCalls failed:", error.message);
    return [];
  }
  return (data as CoachingCallRow[] | null)?.map(rowToCall) ?? [];
}

// Renvoie les appels passés (status accepted/no_show/cancelled, OU upcoming
// dont la date est dépassée). Triés par date décroissante (récents en premier).
export async function getPastCalls(): Promise<CoachingCall[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("coaching_calls")
    .select("id, scheduled_at, host, subject, status, ai_summary")
    .eq("profile_id", user.id)
    .or(
      `status.in.(accepted,no_show,cancelled),and(status.eq.upcoming,scheduled_at.lt.${nowIso})`,
    )
    .order("scheduled_at", { ascending: false });

  if (error) {
    console.error("[coaching/queries] getPastCalls failed:", error.message);
    return [];
  }
  return (data as CoachingCallRow[] | null)?.map(rowToCall) ?? [];
}

// ── Lecture live des appels Notion (V1) ─────────────────────────────────
//
// Forme alignée sur MockCall (src/shared/lib/mock/coaching.ts) pour que
// CallCard accepte les vraies données et les mocks sans branchement. Champs
// supplémentaires `fathom_url` et `notion_page_id` sont optionnels — non
// présents sur MockCall, ignorés par les composants qui ne les consomment pas.
export interface CoachingCallView {
  id: string;
  date: string;
  host: string;
  host_avatar_url?: string; // photo de profil Notion du Host (si disponible)
  subject: string;
  status: "accepted" | "no_show" | "upcoming";
  ai_summary?: string;
  fathom_url?: string;
  notion_page_id?: string;
  // URL "Reschedule URL" Notion (Fillout / TidyCal) — bouton replanifier /
  // annuler, renseigné pour les appels à venir.
  reschedule_url?: string;
  // URL signée vers /api/coaching/transcript/<token> (24h de validité).
  // Renseignée uniquement pour les past calls — embarquée dans les boutons
  // "Demander à ChatGPT/Claude" qui passent l'URL en query string, l'IA
  // suit le lien et lit la transcription brute.
  transcript_url?: string;
}

// Mapping NotionCallStatus → CallStatus (MockCall ne connaît pas "cancelled").
// On regroupe cancelled avec no_show côté UI pour ne pas avoir à créer un 4e
// libellé de pill — un appel annulé apparaît comme "No-show" archivé.
function statusToView(s: NotionCallStatus): CoachingCallView["status"] {
  if (s === "cancelled") return "no_show";
  return s;
}

// Retourne les appels Notion du user courant, splités upcoming/past selon le
// statut et la date. Best-effort : si l'user n'a pas de page Notion liée
// (ensureNotionMemberPage KO) ou si la DB Notion est down, on retourne
// `{upcoming: [], past: []}` — l'UI affiche "aucun appel".
export async function getCallsForCurrentUser(): Promise<{
  upcoming: CoachingCallView[];
  past: CoachingCallView[];
}> {
  const member = await ensureNotionMemberPage();
  if (!member.ok || !member.notionPageId) {
    return { upcoming: [], past: [] };
  }

  const calls = await fetchCallsForMember(member.notionPageId);
  const now = Date.now();
  const upcoming: CoachingCallView[] = [];
  const past: CoachingCallView[] = [];

  for (const c of calls) {
    // Appels ANNULÉS : jamais affichés (ni à venir, ni passés). On les écarte
    // en amont. Les appels sans contenu (no-show / sans résumé) restent eux
    // affichés — seuls les "cancelled" explicites sont masqués.
    if (c.status === "cancelled") continue;

    // Date-based split — la date prime sur le statut Notion :
    //  - date future ET status ≠ no_show/cancelled → upcoming
    //  - tous les autres cas → past
    //
    // Note importante : côté Notion, "Accepté" est le statut par défaut à
    // la création de l'appel (signifiant "accepté dans le système"), pas
    // "déjà eu lieu". On ne peut donc pas baser le split sur le status seul
    // — on regarde la date pour décider, puis le status pour exclure les
    // terminaux explicites (no_show / cancelled).
    const scheduledTs = c.scheduledAt
      ? new Date(c.scheduledAt).getTime()
      : NaN;
    const hasValidDate = !Number.isNaN(scheduledTs);
    // "cancelled" est déjà écarté plus haut (continue) — reste "no_show" comme
    // seul statut terminal explicite.
    const isTerminal = c.status === "no_show";
    const isFutureUpcoming = hasValidDate && scheduledTs >= now && !isTerminal;

    const view: CoachingCallView = {
      id: c.notionPageId,
      date: c.scheduledAt,
      host: c.host || "Théo", // fallback gracieux si host vide
      subject: c.subject,
      // Pill affichée sur la card :
      //  - upcoming si la date est future et pas terminal
      //  - sinon on garde le status Notion (accepted/no_show/cancelled)
      //  - status "upcoming" (= vide Notion) sur un call passé devient no_show
      status: isFutureUpcoming
        ? "upcoming"
        : c.status === "upcoming"
        ? "no_show"
        : statusToView(c.status),
      notion_page_id: c.notionPageId,
    };
    if (c.aiSummary) view.ai_summary = c.aiSummary;
    if (c.fathomUrl) view.fathom_url = c.fathomUrl;
    if (c.hostAvatarUrl) view.host_avatar_url = c.hostAvatarUrl;
    // Lien replanifier / annuler — utile uniquement sur les appels à venir.
    if (isFutureUpcoming && c.rescheduleUrl) {
      view.reschedule_url = c.rescheduleUrl;
    }

    // Token signé pour les past calls uniquement (les upcoming n'ont pas
    // de transcript à servir). Best-effort : si TRANSCRIPT_SIGNING_KEY est
    // absente côté server, signTranscriptToken throw → on log + on laisse
    // transcript_url undefined → les boutons ChatGPT/Claude se masquent
    // côté UI.
    if (!isFutureUpcoming) {
      try {
        const token = signTranscriptToken(c.notionPageId, member.notionPageId);
        // Path public web (pas /api/...) — ChatGPT déclenche son browse tool
        // plus volontiers sur une URL qui ressemble à une page web normale
        // qu'à un endpoint API. Claude n'a pas ce souci, mais le path public
        // marche pour les deux.
        view.transcript_url = `${getOrigin()}/transcript/${token}`;
      } catch (err) {
        console.error(
          "[coaching/queries] signTranscriptToken failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (isFutureUpcoming) {
      upcoming.push(view);
    } else {
      past.push(view);
    }
  }

  // Notion renvoie tri descendant. On veut upcoming en ASC (le plus proche
  // en premier) et past en DESC (le plus récent en premier).
  upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  // past est déjà en DESC vu le sort Notion → rien à faire.

  return { upcoming, past };
}

// ── Prochain appel à venir (pour la pill "Ton prochain coaching est…") ──
//
// Lit la DB Notion Appels de suivi et retourne le PROCHAIN appel à venir
// (status sans valeur OU "À venir") dont la date est ≥ maintenant. Si
// plusieurs candidats, on prend le plus proche dans le temps.
//
// Retourne `null` si :
//  - pas de profil Notion lié (ensureNotionMemberPage KO)
//  - aucun appel à venir
//  - notion KO (best-effort)
//
// Champs exposés à l'UI :
//  - scheduledAt : ISO (utilisé pour le formatage "aujourd'hui / demain / dans X j")
//  - host : nom du Host Notion (people)
//  - hostAvatarUrl : avatar Notion (people) du Host
//  - objectRequest : texte de "Objet de la Demande" (rich_text)
//  - rescheduleUrl : URL "Reschedule URL" (bouton replanifier/annuler)
export interface NextUpcomingCallView {
  notionPageId: string;
  scheduledAt: string;
  host: string;
  hostAvatarUrl: string | null;
  objectRequest: string | null;
  rescheduleUrl: string | null;
}

export async function getNextUpcomingCallForCurrentUser(): Promise<NextUpcomingCallView | null> {
  const member = await ensureNotionMemberPage();
  if (!member.ok || !member.notionPageId) return null;

  const calls = await fetchCallsForMember(member.notionPageId);
  const now = Date.now();

  // Critère "à venir" basé UNIQUEMENT sur la date — pas sur le status. Côté
  // Notion, les appels sont créés par défaut avec status "Accepté" (signifiant
  // "accepté dans le système", pas "déjà eu lieu"). Si on filtrait sur status
  // vide, on perdrait 100% des appels à venir réels.
  //
  // Seuls les statuts terminaux explicites doivent exclure un appel à venir :
  //   - "no_show" → le membre n'est pas venu (acté par l'admin)
  //   - "cancelled" → annulé (acté par l'admin)
  // "accepted" reste candidat car c'est le default Notion.
  const upcoming = calls
    .filter((c) => c.status !== "no_show" && c.status !== "cancelled")
    .filter((c) => {
      if (!c.scheduledAt) return false;
      const ts = new Date(c.scheduledAt).getTime();
      return !Number.isNaN(ts) && ts >= now;
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

  const next = upcoming[0];
  if (!next) return null;

  return {
    notionPageId: next.notionPageId,
    scheduledAt: next.scheduledAt,
    host: next.host || "Théo",
    hostAvatarUrl: next.hostAvatarUrl,
    objectRequest: next.objectRequest,
    rescheduleUrl: next.rescheduleUrl,
  };
}

// Compte le nombre d'appels coachés (accepted) de l'user. Utile pour la
// logique d'état "formation_0_calls" vs "formation_1_call" côté front.
export async function getAcceptedCallsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("coaching_calls")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("status", "accepted");

  if (error) {
    console.error("[coaching/queries] getAcceptedCallsCount failed:", error.message);
    return 0;
  }
  return count ?? 0;
}
