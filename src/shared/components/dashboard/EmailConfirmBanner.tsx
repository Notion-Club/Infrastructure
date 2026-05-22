import { Mail } from "lucide-react";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { EmailConfirmBannerActions } from "./EmailConfirmBannerActions";

// Server Component : lit le profile de l'user courant.
// Affiche le banner uniquement si email_verified_at IS NULL.
// Le visuel (shine card, bouton Gmail) reste celui choisi par Théo dans
// la PR #26 ; les actions (bouton Renvoyer) sont brick branchées sur
// la vraie Server Action resendVerificationEmailAction.
export async function EmailConfirmBanner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.email_verified_at) return null;

  // Email réel de l'user pour décider du raccourci Gmail.
  const email = user.email ?? "";
  const showGmail = isGmailLikeUser(email);

  return (
    <div className="nc-shine-card col-span-1 md:col-span-2">
      <div
        className="nc-shine-card__inner"
        style={{ padding: "20px 24px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(224,98,90,0.08)",
                border: "1px solid rgba(224,98,90,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Mail size={17} style={{ color: "var(--color-brand)" }} />
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                lineHeight: 1.3,
              }}
            >
              Confirme ton adresse email
            </span>
          </div>

          {/* Body */}
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-secondary)",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Tu as reçu un email pour valider ton compte.{" "}
            <span style={{ color: "var(--color-text-muted)" }}>
              Pas reçu ?
            </span>
          </p>

          {/* Actions : Client Component (bouton Renvoyer + cooldown) */}
          <EmailConfirmBannerActions showGmail={showGmail} />
        </div>
      </div>
    </div>
  );
}

// Heuristique conservatrice : on affiche le raccourci Gmail si l'email ne
// correspond pas à un webmail concurrent connu. Les domaines pro custom
// (perso.fr, entreprise.com, etc.) restent éligibles puisqu'ils utilisent
// souvent Google Workspace.
function isGmailLikeUser(email: string): boolean {
  const lower = email.toLowerCase();
  return !["yahoo", "outlook", "hotmail", "live.", "proton", "icloud"].some(
    (p) => lower.includes(p),
  );
}
