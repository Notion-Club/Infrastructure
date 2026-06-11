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

const sendSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().max(400).optional(),
  url: z.string().url().optional(),
  tag: z.string().max(80).optional(),
});

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  return Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
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
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
