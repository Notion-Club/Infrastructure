// POST /api/push/unsubscribe — Retire une PushSubscription du user
// courant. Utilisé quand l'utilisateur désactive le toggle « Push » dans
// Réglages, ou quand le client détecte une souscription périmée.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let endpoint: string;
  try {
    const body = await request.json();
    endpoint = unsubscribeSchema.parse(body).endpoint;
  } catch {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  // RLS impose user_id = auth.uid() : un user ne peut delete que ses
  // propres souscriptions, même s'il fournit l'endpoint d'un autre.
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
