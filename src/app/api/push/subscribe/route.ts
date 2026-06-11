// POST /api/push/subscribe — Enregistre la PushSubscription du
// navigateur actuel dans la table `push_subscriptions`.
//
// Sécurité :
//   - Requiert un user authentifié (cookies Supabase).
//   - RLS Supabase impose user_id = auth.uid() sur l'insert.
//   - Upsert sur `endpoint` (clé unique) : si le même device re-souscrit,
//     on update au lieu de créer un doublon. Si l'endpoint change
//     (re-générée par le navigateur), une nouvelle ligne est créée.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type { PushSubscriptionJSON } from "@/shared/lib/push/types";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let parsed: PushSubscriptionJSON;
  try {
    const body = await request.json();
    parsed = subscribeSchema.parse(body) as PushSubscriptionJSON;
  } catch {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") ?? null;

  // Upsert sur endpoint (unique) : si le device se ré-abonne, on remet
  // expired_at à null et on rafraîchit last_seen_at, plutôt que de créer
  // un doublon.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: parsed.endpoint,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
        expired_at: null,
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
