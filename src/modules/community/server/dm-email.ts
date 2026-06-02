"use server";

import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";

// Service d'envoi des emails de notification DM. Appelé par la route cron
// /api/cron/send-dm-emails qui est elle-même triggée par Vercel Cron toutes
// les 2 minutes. Tout est best-effort : un échec d'envoi loggue mais ne
// fait pas planter le batch — la notif reste en "pending" et sera retentée
// au prochain tick.

interface PendingNotification {
  id: string;
  recipient_id: string;
  conversation_id: string;
  triggered_by_message_id: string;
  scheduled_for: string;
}

interface NotificationContext {
  recipientEmail: string;
  recipientFirstName: string | null;
  senderName: string;
  conversationId: string;
  unreadCount: number;
  previewBody: string;
}

const RESEND_FROM = "Notion Club <noreply@app.notionclub.fr>";

// Drain la queue : sélectionne les notifs prêtes (scheduled_for <= now),
// les envoie via Resend, marque sent_at. Retourne le compte de notifs
// envoyées + skipées + en erreur pour le retour du cron.
export async function processDmEmailQueue(): Promise<{
  sent: number;
  skipped: number;
  errors: number;
}> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[processDmEmailQueue] RESEND_API_KEY manquant");
    return { sent: 0, skipped: 0, errors: 0 };
  }
  const resend = new Resend(resendKey);
  const supabase = createSupabaseAdminClient();

  const { data: pending, error: fetchErr } = await supabase
    .from("dm_email_notifications")
    .select("id, recipient_id, conversation_id, triggered_by_message_id, scheduled_for")
    .is("sent_at", null)
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50)
    .returns<PendingNotification[]>();

  if (fetchErr) {
    console.error("[processDmEmailQueue] fetch failed:", fetchErr.message);
    return { sent: 0, skipped: 0, errors: 1 };
  }

  if (!pending || pending.length === 0) return { sent: 0, skipped: 0, errors: 0 };

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL ?? "theo@gouman.fr";
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.notionclub.fr";

  for (const notif of pending) {
    const ctx = await buildNotificationContext(supabase, notif);
    if (!ctx) {
      // Soit le destinataire a déjà lu la conv depuis (unreadCount = 0), soit
      // ses préférences l'interdisent, soit le message a été supprimé.
      // Dans tous ces cas on marque sent_at pour ne pas réessayer.
      await markSent(supabase, notif.id);
      skipped += 1;
      continue;
    }

    const convUrl = `${origin}/communaute/messages/${notif.conversation_id}`;
    const subject = `${ctx.senderName} t'a envoyé un message`;
    const html = buildHtmlEmail(ctx, convUrl);
    const text = buildPlainTextEmail(ctx, convUrl);

    try {
      const { error: sendError } = await resend.emails.send({
        from: RESEND_FROM,
        to: [ctx.recipientEmail],
        replyTo,
        subject,
        text,
        html,
      });
      if (sendError) {
        console.error("[processDmEmailQueue] Resend error:", sendError.message);
        errors += 1;
        continue;
      }
      await markSent(supabase, notif.id);
      sent += 1;
    } catch (err) {
      console.error("[processDmEmailQueue] send threw:", err);
      errors += 1;
    }
  }

  return { sent, skipped, errors };
}

// Construit le contexte d'envoi pour une notif. Retourne null si on doit
// skipper l'envoi (lecture rattrapée, opt-out, message supprimé, etc.).
async function buildNotificationContext(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  notif: PendingNotification,
): Promise<NotificationContext | null> {
  // 1. Vérifie les préférences email du destinataire pour cette catégorie.
  const { data: pref } = await supabase
    .from("notification_preferences")
    .select("enabled")
    .eq("user_id", notif.recipient_id)
    .eq("category", "community_messages")
    .eq("channel", "email")
    .maybeSingle<{ enabled: boolean }>();

  if (pref?.enabled === false) return null;

  // 2. Vérifie que le destinataire n'a pas lu la conv depuis le scheduled_for
  //    (s'il a ouvert la page entretemps, l'email devient inutile et bruyant).
  const { data: conv } = await supabase
    .from("conversations")
    .select("participant_a_id, participant_b_id, last_read_a_at, last_read_b_at")
    .eq("id", notif.conversation_id)
    .maybeSingle<{
      participant_a_id: string;
      participant_b_id: string;
      last_read_a_at: string;
      last_read_b_at: string;
    }>();

  if (!conv) return null;

  const isA = conv.participant_a_id === notif.recipient_id;
  const lastReadAt = isA ? conv.last_read_a_at : conv.last_read_b_at;

  // 3. Compte les messages reçus non lus dans cette conv (pour le subject /
  //    body si on veut afficher "3 nouveaux messages"). Exclut le destinataire
  //    lui-même (ses propres messages).
  const { data: unreadMessages } = await supabase
    .from("messages")
    .select("body, sender_id, type, created_at")
    .eq("conversation_id", notif.conversation_id)
    .gt("created_at", lastReadAt)
    .neq("sender_id", notif.recipient_id)
    .eq("deleted", false)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<Array<{ body: string; sender_id: string; type: string; created_at: string }>>();

  const unreadCount = unreadMessages?.length ?? 0;
  if (unreadCount === 0) return null;

  // 4. Email + prénom du destinataire (auth.users + profiles).
  const { data: userResp } = await supabase.auth.admin.getUserById(notif.recipient_id);
  const recipientEmail = userResp?.user?.email;
  if (!recipientEmail) return null;

  const { data: recipientProfile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", notif.recipient_id)
    .maybeSingle<{ first_name: string | null }>();

  // 5. Nom de l'expéditeur (depuis le dernier message reçu).
  const latestSenderId = unreadMessages![0]!.sender_id;
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("first_name, last_name, display_name")
    .eq("id", latestSenderId)
    .maybeSingle<{
      first_name: string | null;
      last_name: string | null;
      display_name: string | null;
    }>();

  const senderName = computeSenderName(senderProfile);
  const previewBody = computePreview(unreadMessages![0]!);

  return {
    recipientEmail,
    recipientFirstName: recipientProfile?.first_name ?? null,
    senderName,
    conversationId: notif.conversation_id,
    unreadCount,
    previewBody,
  };
}

function computeSenderName(
  p: { first_name: string | null; last_name: string | null; display_name: string | null } | null,
): string {
  if (!p) return "Un membre du Notion Club";
  const fn = p.first_name?.trim();
  const ln = p.last_name?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  if (fn) return fn;
  return p.display_name?.trim() || "Un membre du Notion Club";
}

function computePreview(msg: { body: string; type: string }): string {
  if (msg.type === "image") return "📷 Image";
  if (msg.type === "pdf") return "📎 Fichier";
  return msg.body.slice(0, 140) + (msg.body.length > 140 ? "…" : "");
}

async function markSent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  notifId: string,
): Promise<void> {
  const { error } = await supabase
    .from("dm_email_notifications")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", notifId);
  if (error) {
    console.error("[markSent] failed:", error.message);
  }
}

function buildPlainTextEmail(ctx: NotificationContext, convUrl: string): string {
  const greeting = ctx.recipientFirstName?.trim() || "Salut";
  const messageWord = ctx.unreadCount > 1 ? `${ctx.unreadCount} nouveaux messages` : "un nouveau message";
  return `${greeting},

${ctx.senderName} t'a envoyé ${messageWord} sur Notion Club.

« ${ctx.previewBody} »

Pour répondre, ouvre la conversation : ${convUrl}

À tout de suite,
L'équipe Notion Club

---
Tu reçois cet email parce que tu as activé les notifications par mail pour
les messages communauté. Tu peux désactiver depuis Réglages > Notifications.`;
}

function buildHtmlEmail(ctx: NotificationContext, convUrl: string): string {
  const greeting = escapeHtml(ctx.recipientFirstName?.trim() || "Salut");
  const messageWord = ctx.unreadCount > 1 ? `<strong>${ctx.unreadCount} nouveaux messages</strong>` : "un <strong>nouveau message</strong>";
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:32px 16px;background:#f5f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${greeting} 👋</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#334155;">
          ${escapeHtml(ctx.senderName)} t'a envoyé ${messageWord} sur Notion Club.
        </p>
        <blockquote style="margin:16px 0;padding:12px 16px;background:#f5f5f5;border-left:3px solid #e0625a;border-radius:6px;font-size:14px;line-height:1.5;color:#334155;">
          ${escapeHtml(ctx.previewBody)}
        </blockquote>
        <p style="margin:24px 0;text-align:center;">
          <a href="${convUrl}" style="display:inline-block;padding:12px 24px;background:#e0625a;color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:600;font-size:15px;">Voir la conversation</a>
        </p>
        <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:16px;">
          Tu reçois cet email parce que tu as activé les notifications par mail
          pour les messages communauté. Tu peux gérer tes préférences depuis
          Réglages > Notifications.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
