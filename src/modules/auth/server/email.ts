"use server";

import { Resend } from "resend";
import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";

// Délai mini entre deux envois de mail de confirmation pour un même user
// (anti-abus du bouton "Renvoyer"). 60 secondes.
const RESEND_THROTTLE_SECONDS = 60;

type SendVerificationEmailInput = {
  userId: string;
  email: string;
  firstName: string | null;
};

// Envoie l'email de confirmation. Lit le token de confirmation sur profiles
// (généré par le trigger handle_new_user) et l'inclut dans le lien.
// Best-effort : si l'envoi échoue, on log mais on ne fait pas planter le
// signup — l'utilisateur peut toujours utiliser "Renvoyer l'email" plus tard.
export async function sendVerificationEmail({
  userId,
  email,
  firstName,
}: SendVerificationEmailInput): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[sendVerificationEmail] RESEND_API_KEY manquant");
    return { ok: false, error: "RESEND_API_KEY missing" };
  }

  const supabase = createSupabaseAdminClient();

  // Récupère le token généré par le trigger.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email_verification_token, email_verified_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error(
      "[sendVerificationEmail] profile introuvable:",
      profileError?.message,
    );
    return { ok: false, error: "profile not found" };
  }

  if (profile.email_verified_at) {
    // Déjà confirmé, pas besoin de renvoyer.
    return { ok: true };
  }

  if (!profile.email_verification_token) {
    console.error(
      "[sendVerificationEmail] token absent pour userId:",
      userId,
    );
    return { ok: false, error: "verification token missing" };
  }

  const origin = await getOrigin();
  const verifyUrl = `${origin}/api/verify-email?token=${profile.email_verification_token}`;

  const resend = new Resend(resendKey);
  const firstNameSafe = firstName?.trim() || "à toi";
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL ?? "theo@gouman.fr";
  // Note : on utilise noreply@app.notionclub.fr en attendant que le domaine
  // racine notionclub.fr soit vérifié dans Resend (Théo doit ajouter 3 DNS
  // records). Une fois vérifié, basculer sur noreply@notionclub.fr.
  const from = "Notion Club <noreply@app.notionclub.fr>";

  const { error: sendError } = await resend.emails.send({
    from,
    to: [email],
    replyTo,
    subject: "Confirme ton adresse email — Notion Club",
    text: buildPlainTextEmail(firstNameSafe, verifyUrl),
    html: buildHtmlEmail(firstNameSafe, verifyUrl),
  });

  if (sendError) {
    console.error("[sendVerificationEmail] Resend error:", sendError);
    return { ok: false, error: sendError.message };
  }

  return { ok: true };
}

// Rate-limit + (re)génère un token si besoin, puis appelle sendVerificationEmail.
// Utilisé par le bouton "Renvoyer l'email" du banner. Retourne ok=false avec
// retryAfterSeconds si on a envoyé trop récemment.
export async function resendVerificationEmail({
  userId,
}: {
  userId: string;
}): Promise<{ ok: boolean; retryAfterSeconds?: number; error?: string }> {
  const supabase = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "email_verification_token, email_verification_sent_at, email_verified_at, first_name",
    )
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { ok: false, error: "profile not found" };
  }

  if (profile.email_verified_at) {
    return { ok: false, error: "already verified" };
  }

  // Rate-limit
  if (profile.email_verification_sent_at) {
    const lastSent = new Date(profile.email_verification_sent_at).getTime();
    const elapsedSec = Math.floor((Date.now() - lastSent) / 1000);
    if (elapsedSec < RESEND_THROTTLE_SECONDS) {
      return {
        ok: false,
        retryAfterSeconds: RESEND_THROTTLE_SECONDS - elapsedSec,
      };
    }
  }

  // Récupère l'email depuis auth.users pour le destinataire.
  const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(
    userId,
  );
  if (userErr || !userResp?.user?.email) {
    return { ok: false, error: "user email not found" };
  }

  // Si pas de token (cas rare où il aurait été effacé manuellement), on
  // en regénère un.
  if (!profile.email_verification_token) {
    const { error: tokenErr } = await supabase
      .from("profiles")
      .update({ email_verification_token: crypto.randomUUID() })
      .eq("id", userId);
    if (tokenErr) {
      return { ok: false, error: tokenErr.message };
    }
  }

  // Update sent_at AVANT envoi pour éviter qu'un retry rapide passe.
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ email_verification_sent_at: new Date().toISOString() })
    .eq("id", userId);
  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  const result = await sendVerificationEmail({
    userId,
    email: userResp.user.email,
    firstName: profile.first_name,
  });
  return result;
}

// ============================================================================
// Helpers
// ============================================================================

async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function buildPlainTextEmail(firstName: string, verifyUrl: string): string {
  return `Salut ${firstName},

Merci de t'être inscrit·e au Notion Club. Pour finaliser ton inscription,
confirme ton adresse email en cliquant sur ce lien :

${verifyUrl}

Tu peux d'ores et déjà te connecter à ton espace — le rappel restera
affiché jusqu'à ce que tu valides ton email.

À tout de suite,
L'équipe Notion Club`;
}

function buildHtmlEmail(firstName: string, verifyUrl: string): string {
  // Style inline pour compatibilité max avec les clients mail.
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:32px 16px;background:#f5f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Bienvenue ${escapeHtml(firstName)} 👋</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#334155;">
          Merci de t'être inscrit·e au Notion Club. Pour finaliser ton inscription,
          confirme ton adresse email en cliquant sur le bouton ci-dessous.
        </p>
        <p style="margin:24px 0;text-align:center;">
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#e0625a;color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:600;font-size:15px;">Confirmer mon email</a>
        </p>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b;">
          Tu peux déjà te connecter à ton espace — le rappel restera affiché
          dans ton tableau de bord jusqu'à ce que tu valides ton email.
        </p>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
          Si le bouton ne fonctionne pas, copie-colle ce lien dans ton navigateur :<br>
          <span style="word-break:break-all;">${verifyUrl}</span>
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
