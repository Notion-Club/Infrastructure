import "server-only";

import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";
import { sendWebPushToUser } from "@/shared/lib/push/webPush";
import type { NotificationType } from "../types/notification.types";

// ============================================================================
// Pont notifications in-app → Web Push (téléphone / PWA standalone)
// ============================================================================
// Les notifications in-app sont créées par les triggers DB (mig. 038). Ce
// helper ajoute la couche "push téléphone" par-dessus : appelé depuis les
// server actions community APRÈS l'écriture de l'événement, il envoie un Web
// Push au destinataire via l'infra de Théo (sendWebPushToUser → SW public/sw.js).
//
// Garde-fous (dans l'ordre) :
//   1. Pas de self-notify (recipient = actor) — défense en profondeur, les
//      call sites filtrent déjà.
//   2. Toggle global push (channel_preferences) : si l'user a explicitement
//      coupé le canal push, on n'envoie rien. Absence de row = on continue
//      (mais sendWebPushToUser ne fait rien sans souscription active de toute
//      façon — le push est opt-in par nature : pas de sub = pas de push).
//   3. sendWebPushToUser gère le reste (souscriptions périmées, récap).
//
// Sémantique fire-and-forget : ce helper ne throw JAMAIS vers l'appelant et
// ne doit jamais bloquer/échouer une server action. Un push qui rate ne doit
// pas empêcher un commentaire d'être posté. On log et on avale.

interface PushNotifyArgs {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  /** Extrait (titre de post, début de commentaire/message) — corps du push. */
  excerpt?: string | null;
  /** Deep-link ouvert au tap sur la notif (chemin relatif). */
  url: string;
}

// Résout le nom d'affichage de l'acteur (même cascade que queries.ts /
// notifications.ts : first+last → first → last → display_name → username).
async function resolveActorName(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  actorId: string,
): Promise<string> {
  const { data: p } = await admin
    .from("profiles")
    .select("first_name, last_name, display_name, username")
    .eq("id", actorId)
    .maybeSingle<{
      first_name: string | null;
      last_name: string | null;
      display_name: string | null;
      username: string | null;
    }>();
  if (!p) return "Quelqu'un";
  const fn = p.first_name?.trim();
  const ln = p.last_name?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  if (fn) return fn;
  if (ln) return ln;
  return p.display_name?.trim() || p.username || "Quelqu'un";
}

// Verbe par type, aligné sur NOTIF_LABELS du popover in-app pour cohérence.
const PUSH_VERB: Record<NotificationType, string> = {
  mention_post: "t'a mentionné",
  mention_comment: "t'a mentionné",
  comment_on_post: "a commenté ton post",
  reply_to_comment: "a répondu à ton commentaire",
  reaction_on_post: "a réagi à ton post",
  new_dm: "t'a envoyé un message",
  admin_annonce: "a publié une annonce",
  // admin_push ne transite jamais par ce pont (les push admin partent en direct
  // via sendAdminPushAction). Clé présente pour l'exhaustivité du Record.
  admin_push: "",
};

function buildTitle(actorName: string, type: NotificationType): string {
  return `${actorName} ${PUSH_VERB[type]}`;
}

function buildBody(excerpt: string | null | undefined): string | undefined {
  const e = excerpt?.trim();
  if (!e) return undefined;
  return e.length > 120 ? `${e.slice(0, 120)}…` : e;
}

// Envoie un Web Push à un destinataire pour un événement community.
// Ne throw jamais. À appeler sans await bloquant si possible (fire-and-forget),
// ou avec await dans un try/catch déjà présent — l'erreur est avalée ici.
export async function notifyPush(args: PushNotifyArgs): Promise<void> {
  try {
    if (!args.recipientId || args.recipientId === args.actorId) return;

    const admin = createSupabaseAdminClient();

    // Toggle global push : skip uniquement si explicitement désactivé.
    const { data: channelPref } = await admin
      .from("channel_preferences")
      .select("enabled")
      .eq("user_id", args.recipientId)
      .eq("channel", "push")
      .maybeSingle<{ enabled: boolean }>();

    if (channelPref?.enabled === false) return;

    const actorName = await resolveActorName(admin, args.actorId);

    await sendWebPushToUser(args.recipientId, {
      title: buildTitle(actorName, args.type),
      body: buildBody(args.excerpt),
      tag: args.type, // regroupe les notifs du même type côté OS
      data: { url: args.url },
    });
  } catch (err) {
    // Fire-and-forget : on n'impacte jamais l'action appelante.
    console.error("[notifyPush] envoi push échoué (non bloquant):", err);
  }
}

// Fan-out : envoie le même push à plusieurs destinataires (annonce admin).
// Résout le nom de l'acteur UNE fois (et pas N), puis parallélise les envois
// en respectant le toggle push de chaque destinataire. N'échoue jamais.
export async function notifyPushMany(
  recipientIds: string[],
  base: Omit<PushNotifyArgs, "recipientId">,
): Promise<void> {
  try {
    if (recipientIds.length === 0) return;
    const admin = createSupabaseAdminClient();
    const actorName = await resolveActorName(admin, base.actorId);
    const title = buildTitle(actorName, base.type);
    const body = buildBody(base.excerpt);

    await Promise.all(
      recipientIds.map(async (recipientId) => {
        try {
          if (!recipientId || recipientId === base.actorId) return;
          const { data: channelPref } = await admin
            .from("channel_preferences")
            .select("enabled")
            .eq("user_id", recipientId)
            .eq("channel", "push")
            .maybeSingle<{ enabled: boolean }>();
          if (channelPref?.enabled === false) return;

          await sendWebPushToUser(recipientId, {
            title,
            body,
            tag: base.type,
            data: { url: base.url },
          });
        } catch (err) {
          console.error("[notifyPushMany] envoi échoué pour un destinataire:", err);
        }
      }),
    );
  } catch (err) {
    console.error("[notifyPushMany] fan-out échoué (non bloquant):", err);
  }
}
