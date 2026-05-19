import { Mail } from "lucide-react";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { EmailVerificationResendButton } from "./EmailVerificationResendButton";

// Server Component : se résout côté serveur, lit le profile de l'user courant.
// Si email_verified_at IS NULL → affiche le banner. Sinon → render null.
// L'app peut l'insérer librement en haut de /dashboard, /settings, etc.
export async function EmailNotVerifiedBanner() {
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

  // Profile absent (cas rare : trigger échoué) ou email déjà vérifié → on
  // ne montre rien.
  if (!profile || profile.email_verified_at) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-[rgba(224,98,90,0.25)] bg-[rgba(224,98,90,0.08)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Mail
          className="mt-0.5 size-5 flex-shrink-0 text-[var(--color-brand)]"
          aria-hidden
        />
        <div className="flex flex-col gap-0.5">
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            Confirme ton adresse email
          </p>
          <p className="text-[13px] leading-snug text-[var(--color-text-secondary)]">
            Tu as reçu un email pour valider ton compte. Pas reçu ? Clique sur
            « Renvoyer l&apos;email ».
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 sm:ml-4">
        <EmailVerificationResendButton />
      </div>
    </div>
  );
}
