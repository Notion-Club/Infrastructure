import webpush from "web-push";

import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";
import { getServerVapidConfig } from "./vapid";
import type { PushPayload } from "./types";

// Helper SERVER ONLY pour envoyer un Web Push à un utilisateur.
//
// Cycle de vie :
//   1. Configure web-push avec les VAPID keys (idempotent grâce au cache
//      module-level).
//   2. Récupère toutes les souscriptions actives (expired_at IS NULL) de
//      l'user via le service_role client (bypass RLS).
//   3. Boucle, envoie le payload chiffré sur chaque endpoint.
//   4. Sur 404/410, marque la souscription `expired_at = now()` — le
//      device a désinstallé la PWA ou révoqué la permission. On NE delete
//      PAS (audit + re-subscribe potentiel).
//   5. Retourne un récap { sent, expired, failed }.

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const { publicKey, privateKey, subject } = getServerVapidConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export type SendPushResult = {
  sent: number;
  expired: number;
  failed: number;
  failures: Array<{ endpoint: string; error: string }>;
};

export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<SendPushResult> {
  ensureVapidConfigured();
  const admin = createSupabaseAdminClient();

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .is("expired_at", null);

  if (error) {
    throw new Error(`push_subscriptions read failed: ${error.message}`);
  }
  if (!subs || subs.length === 0) {
    return { sent: 0, expired: 0, failed: 0, failures: [] };
  }

  const result: SendPushResult = {
    sent: 0,
    expired: 0,
    failed: 0,
    failures: [],
  };
  const expiredIds: string[] = [];
  const seenIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
        result.sent += 1;
        seenIds.push(sub.id);
      } catch (err) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        if (status === 404 || status === 410) {
          // Endpoint définitivement mort : le device a désinstallé la
          // PWA ou révoqué la permission. On marque comme périmé.
          expiredIds.push(sub.id);
          result.expired += 1;
        } else {
          result.failed += 1;
          result.failures.push({
            endpoint: sub.endpoint,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }),
  );

  if (expiredIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .update({ expired_at: new Date().toISOString() })
      .in("id", expiredIds);
  }
  if (seenIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .update({ last_seen_at: new Date().toISOString() })
      .in("id", seenIds);
  }

  return result;
}
