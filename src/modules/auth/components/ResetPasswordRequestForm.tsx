"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import type { ZodIssue } from "zod";

import { resetPasswordRequestSchema } from "@/modules/auth/lib/validation";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

// Décision Brique 1 — sécurité : ne JAMAIS révéler si l'email existe.
const GENERIC_MESSAGE =
  "Si cet email existe dans nos systèmes, un lien de réinitialisation a été envoyé.";

// Le flow reset password Supabase utilise PKCE. Le code verifier doit être
// stocké côté browser pour pouvoir être récupéré au retour du clic du lien
// email (sinon "PKCE code verifier not found in storage"). On appelle donc
// resetPasswordForEmail directement depuis le browser client.
type FieldErrors = { email?: string };

// Contenu interne (header + formulaire + retour), SANS la carte .nc-shine-card.
// Réutilisé tel quel par :
//   • la page autonome /reset-password (enveloppé dans une .nc-shine-card) ;
//   • le slide in-card de l'AuthCard (page 2 « mot de passe oublié »).
// `onBack` fourni → « Retour à la connexion » devient un bouton qui re-slide
// vers le formulaire de connexion ; sinon c'est un lien vers /login.
export function ResetPasswordRequestContent({
  onBack,
}: {
  onBack?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const formData = new FormData(event.currentTarget);
    setFieldErrors({});

    const raw = { email: String(formData.get("email") ?? "") };
    const parsed = resetPasswordRequestSchema.safeParse(raw);
    if (!parsed.success) {
      setFieldErrors(extractFieldErrors(parsed.error.issues));
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        parsed.data.email,
        {
          redirectTo: `${window.location.origin}/update-password`,
        },
      );

      // Best-effort : message générique systématique, même si erreur réseau
      // ou email inexistant — pas de signal exploitable côté client.
      if (error) {
        console.error("[resetPasswordForEmail] supabase error:", error.message);
      }

      setSuccessMessage(GENERIC_MESSAGE);
    });
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        <h2
          className="text-[18px] font-semibold text-[var(--color-text-primary)]"
          data-fb-label="Titre · Formulaire mot de passe oublié"
        >
          Mot de passe oublié
        </h2>
        <p className="text-[14px] text-[var(--color-text-secondary)]">
          Renseigne ton email, on t&apos;envoie un lien pour définir un nouveau
          mot de passe.
        </p>
      </header>

      {successMessage ? (
        <div
          role="status"
          data-fb-label="Encadré Confirmation envoi · Formulaire mot de passe oublié"
          className="rounded-2xl border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-4 py-3 text-[14px] leading-snug text-[var(--color-text-primary)]"
        >
          {successMessage}
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          noValidate
          data-fb-label="Formulaire · Formulaire mot de passe oublié"
        >
          <label htmlFor="email" className="flex flex-col gap-2">
            <span className="text-[14px] font-medium text-[var(--color-text-secondary)]">
              Email
            </span>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="toi@exemple.com"
              autoComplete="email"
              required
              disabled={isPending}
              aria-invalid={fieldErrors.email ? true : undefined}
              data-fb-label="Champ Email · Formulaire mot de passe oublié"
              className="nc-input disabled:cursor-not-allowed disabled:opacity-60"
            />
            {fieldErrors.email && (
              <p className="text-[13px] text-[var(--color-brand)]">
                {fieldErrors.email}
              </p>
            )}
          </label>

          <button
            type="submit"
            disabled={isPending}
            data-fb-label="Bouton Envoyer le lien · Formulaire mot de passe oublié"
            className="nc-btn-shine group flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(224,98,90,0.55)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(224,98,90,0.65)] active:translate-y-0 active:shadow-[0_6px_16px_-6px_rgba(224,98,90,0.55)] disabled:cursor-not-allowed disabled:opacity-80"
          >
            <span className="relative z-10 flex items-center gap-2">
              {isPending && <LoaderCircle className="size-4 animate-spin" />}
              {isPending ? "Envoi…" : "Envoyer le lien"}
            </span>
          </button>
        </form>
      )}

      <p className="text-center text-[14px] text-[var(--color-text-muted)]">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="font-medium text-[var(--color-text-secondary)] underline underline-offset-4 hover:text-[var(--color-text-primary)]"
            data-fb-label="Retour à la connexion · Formulaire mot de passe oublié"
          >
            Retour à la connexion
          </button>
        ) : (
          <Link
            href="/login"
            className="font-medium text-[var(--color-text-secondary)] underline underline-offset-4 hover:text-[var(--color-text-primary)]"
            data-fb-label="Lien Retour à la connexion · Formulaire mot de passe oublié"
          >
            Retour à la connexion
          </Link>
        )}
      </p>
    </>
  );
}

// Page autonome /reset-password : la même carte « shine » que l'AuthCard.
export function ResetPasswordRequestForm() {
  return (
    <div
      className="nc-shine-card w-full max-w-[420px]"
      data-fb-label="Carte auth · Mot de passe oublié"
    >
      <div className="nc-shine-card__inner flex flex-col gap-6">
        <ResetPasswordRequestContent />
      </div>
    </div>
  );
}

function extractFieldErrors(issues: ZodIssue[]): FieldErrors {
  const errs: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof FieldErrors;
    if (field && !errs[field]) errs[field] = issue.message;
  }
  return errs;
}
