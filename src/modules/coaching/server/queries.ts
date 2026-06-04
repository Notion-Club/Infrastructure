// Queries serveur coaching — lecture des appels coaching de l'user.
// La RLS coaching_calls_select_self_or_admin filtre déjà côté DB, donc
// l'user n'accède jamais qu'à ses propres appels (ou tous s'il est admin).

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

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
