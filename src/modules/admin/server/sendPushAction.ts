"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";
import { sendWebPushToUser } from "@/shared/lib/push/webPush";
import { createAdminPushNotifications } from "@/shared/lib/push/inAppNotification";

// Server Action consommée par le dev tool admin (cf. AdminPushDevCard).
// Trois cibles possibles : envoyer une notif push à soi-même, à un user
// précis (par UUID), ou à tous les abonnés actifs (`expired_at IS NULL`).
//
// Sécurité — double défense :
//   1. UI : la carte n'est montée dans le DevToolbox QUE pour les admins.
//   2. Serveur : on re-vérifie ici que le caller a role='admin' dans
//      public.profiles. Sans ça, n'importe quel utilisateur authentifié
//      pourrait poster vers cette action et broadcaster à tous.

const targetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("self") }),
  z.object({
    type: z.literal("users"),
    userIds: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({ type: z.literal("all") }),
]);

const sendAdminPushSchema = z.object({
  target: targetSchema,
  title: z.string().min(1, "Titre requis").max(120),
  body: z.string().max(400).optional(),
  url: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .optional(),
});

export type SendAdminPushInput = z.infer<typeof sendAdminPushSchema>;

export type SendAdminPushResult =
  | {
      ok: true;
      // Agrégat sur tous les recipients touchés.
      sent: number;
      expired: number;
      failed: number;
      // Combien d'utilisateurs distincts ont été ciblés (1 pour self/user,
      // N pour "all"). Utile pour le toast "envoyé à N personnes".
      recipients: number;
    }
  | {
      ok: false;
      code:
        | "not_authenticated"
        | "forbidden"
        | "validation"
        | "no_subscribers"
        | "unknown";
      message: string;
    };

export async function sendAdminPushAction(
  raw: unknown,
): Promise<SendAdminPushResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: "not_authenticated",
      message: "Tu n'es pas authentifié.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      message: "Réservé aux administrateurs.",
    };
  }

  const parsed = sendAdminPushSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "Payload invalide.",
    };
  }
  const input = parsed.data;

  const payload = {
    title: input.title,
    body: input.body,
    data: input.url ? { url: input.url } : undefined,
  };

  const recipientIds = await resolveRecipientIds(input.target, user.id);

  if (recipientIds.length === 0) {
    return {
      ok: false,
      code: "no_subscribers",
      message:
        input.target.type === "all"
          ? "Aucun abonné actif pour le moment."
          : "Aucun des membres sélectionnés n'a de souscription active.",
    };
  }

  let sent = 0;
  let expired = 0;
  let failed = 0;

  for (const recipientId of recipientIds) {
    try {
      const result = await sendWebPushToUser(recipientId, payload);
      sent += result.sent;
      expired += result.expired;
      failed += result.failed;
    } catch {
      // sendWebPushToUser throw uniquement si la lecture DB plante ou si
      // VAPID manque. On compte +1 failed pour cet user et on continue.
      failed += 1;
    }
  }

  // Trace in-app : on insère une notification 'admin_push' par destinataire
  // pour que le push apparaisse aussi dans la cloche (Realtime → badge live).
  // Indépendant du résultat d'envoi push : un device sans souscription active
  // n'a pas reçu le push, mais doit quand même retrouver la notif en in-app.
  // Fire-and-forget — n'impacte jamais le récap d'envoi.
  await createAdminPushNotifications(recipientIds, {
    title: input.title,
    body: input.body,
    link: input.url,
  });

  return {
    ok: true,
    sent,
    expired,
    failed,
    recipients: recipientIds.length,
  };
}

async function resolveRecipientIds(
  target: SendAdminPushInput["target"],
  callerUserId: string,
): Promise<string[]> {
  if (target.type === "self") return [callerUserId];
  if (target.type === "users") {
    // Dédoublonne et exclut les éventuels doublons (admin qui se sélectionne
    // lui-même dans la liste en plus de la cible "Moi", etc.).
    return Array.from(new Set(target.userIds));
  }

  // type === "all" : on récupère les user_id distincts ayant au moins
  // une souscription active. Via admin client pour bypass RLS.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .is("expired_at", null);

  if (error || !data) return [];
  return Array.from(new Set(data.map((row) => row.user_id)));
}
