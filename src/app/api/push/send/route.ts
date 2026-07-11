// POST /api/push/send — Envoie un Web Push à un user donné.
//
// Auth : machine-to-machine via `Authorization: Bearer <CRON_SECRET>`
// (cohérent avec /api/cron/send-dm-emails). Pas d'auth user — cette
// route est destinée à être appelée depuis un cron Vercel, un webhook
// Notion, un script admin curl, etc.
//
// Sémantique :
//   - Cherche TOUTES les souscriptions actives du userId
//   - Envoie le payload sur chaque endpoint
//   - Les souscriptions périmées sont marquées `expired_at` (cf. webPush.ts)
//   - Retourne le récap { sent, expired, failed }
//
// Pas d'idempotence native — appeler 2× envoie 2 pushes. À gérer côté
// caller (par exemple en stockant un sent_at sur l'entité métier).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendWebPushToUser } from "@/shared/lib/push/webPush";
import { createAdminPushNotifications } from "@/shared/lib/push/inAppNotification";
import { isCronRequest } from "@/shared/lib/auth/cron";

const sendSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().max(400).optional(),
  url: z.string().url().optional(),
  tag: z.string().max(80).optional(),
});

export async function POST(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let parsed: z.infer<typeof sendSchema>;
  try {
    const body = await request.json();
    parsed = sendSchema.parse(body);
  } catch {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  try {
    const result = await sendWebPushToUser(parsed.userId, {
      title: parsed.title,
      body: parsed.body,
      tag: parsed.tag,
      data: parsed.url ? { url: parsed.url } : undefined,
    });

    // Trace in-app : le push doit aussi apparaître dans la cloche du
    // destinataire (Realtime → badge live), même si aucun device n'avait de
    // souscription active. Fire-and-forget — n'impacte pas la réponse.
    await createAdminPushNotifications([parsed.userId], {
      title: parsed.title,
      body: parsed.body,
      link: parsed.url,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
