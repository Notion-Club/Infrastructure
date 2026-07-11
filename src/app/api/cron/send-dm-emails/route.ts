// GET /api/cron/send-dm-emails — drain la queue d'emails de notif DM.
//
// Déclenché par Vercel Cron (cf. vercel.json) une fois par jour à 9h UTC
// — limite Hobby (1 cron/jour). La route vérifie l'authentification via :
//   - `Authorization: Bearer <CRON_SECRET>` (méthode admin custom)
//   - OU Vercel Cron qui injecte `x-vercel-cron: 1` (header de confiance
//     uniquement quand la requête vient de l'infra Vercel)
//
// Idempotent : si on rappelle deux fois dans la même journée, le second
// appel ne renverra rien (les notifs ont déjà sent_at non-null). Si le
// premier appel a planté à mi-chemin, les notifs non envoyées seront
// reprises au prochain tick (le lendemain à 9h).
import { NextRequest, NextResponse } from "next/server";
import { processDmEmailQueue } from "@/modules/community/server/dm-email";
import { isCronRequest } from "@/shared/lib/auth/cron";

function isAuthorized(request: NextRequest): boolean {
  // Secret machine partagé…
  if (isCronRequest(request)) return true;
  // …ou header Vercel Cron : injecté par l'infra et inforgeable côté public
  // (Vercel le strip des requêtes externes).
  return request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  try {
    const result = await processDmEmailQueue();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/send-dm-emails] failed:", err);
    return NextResponse.json(
      { error: "Échec du traitement de la queue" },
      { status: 500 },
    );
  }
}
