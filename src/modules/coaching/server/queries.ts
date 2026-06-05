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
  subject: string;
  status: "accepted" | "no_show" | "upcoming";
  ai_summary?: string;
  fathom_url?: string;
  notion_page_id?: string;
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
    const view: CoachingCallView = {
      id: c.notionPageId,
      date: c.scheduledAt,
      host: c.host || "Théo", // fallback gracieux si host vide
      subject: c.subject,
      status: statusToView(c.status),
      notion_page_id: c.notionPageId,
    };
    if (c.aiSummary) view.ai_summary = c.aiSummary;
    if (c.fathomUrl) view.fathom_url = c.fathomUrl;

    // Un call est "à venir" UNIQUEMENT si son statut est upcoming ET sa date
    // est dans le futur. Un upcoming expiré (admin a oublié de le passer en
    // accepted/no_show) tombe dans past pour ne pas polluer la section
    // "prochains coachings".
    const scheduledTs = view.date ? new Date(view.date).getTime() : NaN;
    const isFutureUpcoming =
      c.status === "upcoming" && !Number.isNaN(scheduledTs) && scheduledTs >= now;

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
