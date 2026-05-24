"use server";

// Server Actions de progression formation. Écriture self-only (RLS).
// Toutes upsertent sur (profile_id, course_id).

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { notionFetch, NotionError } from "@/shared/lib/notion/client";

// Base Notion « Feedbacks » (157bad05…) — schéma : Nom (title), Avis (select),
// Suggestion / Cours / Formation / Module / User / User Agent (text).
const FEEDBACK_DB_ID = "157bad05-6a95-8055-9d63-f8b5d3734324";

async function requireUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  return { supabase, userId: user.id };
}

export async function markCourseCompleted(courseId: string): Promise<void> {
  const { supabase, userId } = await requireUserId();
  const now = new Date().toISOString();
  await supabase.from("formation_course_progress").upsert(
    {
      profile_id: userId,
      course_id: courseId,
      status: "completed",
      completed_at: now,
      last_accessed_at: now,
    },
    { onConflict: "profile_id,course_id" },
  );
  revalidatePath("/formation", "layout");
}

// Marque le cours comme "vu" (last_accessed) sans le compléter. Crée la ligne
// in_progress si absente — sert au "Reprendre où j'en étais".
export async function touchCourseAccess(courseId: string): Promise<void> {
  const { supabase, userId } = await requireUserId();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("formation_course_progress")
    .select("id, status")
    .eq("profile_id", userId)
    .eq("course_id", courseId)
    .maybeSingle<{ id: string; status: string }>();

  if (existing) {
    await supabase
      .from("formation_course_progress")
      .update({ last_accessed_at: now })
      .eq("id", existing.id);
  } else {
    await supabase.from("formation_course_progress").insert({
      profile_id: userId,
      course_id: courseId,
      status: "in_progress",
      last_accessed_at: now,
    });
  }
}

export async function saveCourseNote(
  courseId: string,
  content: string,
): Promise<void> {
  const { supabase, userId } = await requireUserId();
  // Garde-fou longueur (aligné sur la limite UI 50 000).
  const clipped = content.slice(0, 50_000);
  await supabase.from("formation_course_notes").upsert(
    {
      profile_id: userId,
      course_id: courseId,
      content: clipped,
    },
    { onConflict: "profile_id,course_id" },
  );
}

// Helpers de construction des propriétés Notion.
function notionText(value: string) {
  return { rich_text: [{ text: { content: value.slice(0, 1900) } }] };
}

// Envoie un feedback de leçon dans la base Notion « Feedbacks ».
// `avis` doit correspondre exactement à une option du select Avis.
export async function submitCourseFeedback(input: {
  avis: string;
  suggestion: string;
  courseName: string;
  formationName: string;
  moduleName: string;
}): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username = user?.email ?? "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, full_name")
      .eq("id", user.id)
      .maybeSingle<{
        username: string | null;
        display_name: string | null;
        full_name: string | null;
      }>();
    username =
      profile?.username ||
      profile?.display_name ||
      profile?.full_name ||
      user.email ||
      "";
  }

  const userAgent = (await headers()).get("user-agent") ?? "";

  try {
    await notionFetch("/pages", {
      method: "POST",
      body: {
        parent: { database_id: FEEDBACK_DB_ID },
        properties: {
          Nom: { title: [{ text: { content: input.courseName.slice(0, 190) } }] },
          Avis: { select: { name: input.avis } },
          Suggestion: notionText(input.suggestion),
          Cours: notionText(input.courseName),
          Formation: notionText(input.formationName),
          Module: notionText(input.moduleName),
          User: notionText(username),
          "User Agent": notionText(userAgent),
        },
      },
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof NotionError ? `${err.status} ${err.message}` : String(err);
    console.error("[formation/feedback] Notion error:", msg);
    return { ok: false };
  }
}
