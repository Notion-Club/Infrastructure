"use server";

// Server Actions de progression formation. Écriture self-only (RLS).
// Toutes upsertent sur (profile_id, course_id).

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

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
