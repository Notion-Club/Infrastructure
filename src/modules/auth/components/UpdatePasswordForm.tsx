"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { ZodIssue } from "zod";

import { updatePasswordSchema } from "@/modules/auth/lib/validation";
import { updatePasswordFromRecoveryAction } from "@/modules/auth/server/actions";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

// Page de définition d'un nouveau mot de passe après clic sur le lien email.
//
// Flow Supabase Auth "implicit" (cf. client.ts) :
// - Le lien email contient #access_token=…&refresh_token=…&type=recovery
//   dans le hash fragment (et non en query string).
// - Au mount du browser client, Supabase détecte automatiquement ces tokens
//   et établit la session. On a juste à attendre que getUser() retourne
//   l'user puis on affiche le form.
// - Marche cross-browser/cross-device (pas de code verifier PKCE requis).
//
// États :
// - "loading" : détection auto en cours. Loader.
// - "ready" : session établie, form affiché.
// - "expired" : pas de session après détection (lien expiré, déjà utilisé,
//   ou accès direct à /update-password sans token).
type LoadState = "loading" | "ready" | "expired";
type FieldErrors = { password?: string; confirmPassword?: string };

export function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let cancelled = false;
    const errorParam = searchParams.get("error");

    async function bootstrap() {
      // Cas : Supabase a déjà rejeté le lien (par ex. cliqué 2 fois) — il
      // ajoute ?error=access_denied&error_code=otp_expired en query string.
      if (errorParam) {
        if (!cancelled) setLoadState("expired");
        return;
      }

      const supabase = createSupabaseBrowserClient();

      // Avec flowType: "implicit" + detectSessionInUrl: true (défaut),
      // Supabase parse automatiquement le hash fragment de l'URL au mount
      // pour extraire access_token/refresh_token et établir la session.
      // On utilise onAuthStateChange pour attendre cette détection (qui
      // peut être asynchrone si la lib doit faire un round-trip réseau).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        setLoadState("ready");
        return;
      }

      // Pas de session immédiate : peut-être que la détection est encore
      // en cours. On attend SIGNED_IN ou un timeout court.
      const { data: subscription } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (cancelled) return;
          if (event === "SIGNED_IN" && session?.user) {
            setLoadState("ready");
          }
        },
      );

      // Timeout de sécurité : si après 3s on n'a toujours pas de session,
      // c'est que le lien est invalide.
      setTimeout(() => {
        if (cancelled) return;
        setLoadState((current) => (current === "loading" ? "expired" : current));
      }, 3000);

      return () => {
        subscription.subscription.unsubscribe();
      };
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || loadState !== "ready") return;

    const formData = new FormData(event.currentTarget);
    setFieldErrors({});

    const raw = {
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };
    const parsed = updatePasswordSchema.safeParse(raw);
    if (!parsed.success) {
      setFieldErrors(extractFieldErrors(parsed.error.issues));
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();

      // Récupère les tokens de la session recovery (établie côté browser via
      // le flow implicit). On passe les DEUX à la Server Action qui appelle
      // setSession() côté serveur — nécessaire pour updateUser({password}),
      // un simple Bearer header ne suffit pas pour les mutations.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !session?.refresh_token) {
        setLoadState("expired");
        return;
      }

      const result = await updatePasswordFromRecoveryAction({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        newPassword: parsed.data.password,
        confirmPassword: parsed.data.confirmPassword,
      });

      if (!result.ok) {
        if (result.code === "password_reused") {
          setFieldErrors({ password: result.message });
          return;
        }
        if (result.code === "weak_password") {
          setFieldErrors({ password: result.message });
          return;
        }
        if (result.code === "invalid_session") {
          setLoadState("expired");
          return;
        }
        toast.error(result.message);
        return;
      }

      // Déconnecte la session recovery pour forcer un vrai login avec le
      // nouveau mdp (clean state, et confirme que le mdp marche).
      await supabase.auth.signOut();

      toast.success(
        "Mot de passe mis à jour. Connecte-toi avec ton nouveau mot de passe.",
      );
      router.push("/login");
    });
  }

  if (loadState === "loading") {
    return (
      <div
        className="nc-shine-card w-full max-w-[420px]"
        data-fb-label="Carte auth · Vérification du lien"
      >
        <div className="nc-shine-card__inner flex flex-col items-center gap-4 py-6">
          <LoaderCircle className="size-6 animate-spin text-[var(--color-text-muted)]" />
          <p className="text-[14px] text-[var(--color-text-secondary)]">
            Vérification du lien…
          </p>
        </div>
      </div>
    );
  }

  if (loadState === "expired") {
    return (
      <div
        className="nc-shine-card w-full max-w-[420px]"
        data-fb-label="Carte auth · Lien expiré"
      >
        <div className="nc-shine-card__inner flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h2
              className="text-[18px] font-semibold text-[var(--color-text-primary)]"
              data-fb-label="Titre Lien expiré · Carte lien expiré"
            >
              Lien expiré
            </h2>
            <p className="text-[14px] text-[var(--color-text-secondary)]">
              Ce lien de réinitialisation a expiré ou a déjà été utilisé.
              Demande un nouveau lien pour continuer.
            </p>
          </header>
          <Link
            href="/reset-password"
            data-fb-label="Bouton Demander un nouveau lien · Carte lien expiré"
            className="nc-btn-shine group flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3.5 text-[15px] font-semibold text-white no-underline shadow-[0_8px_24px_-8px_rgba(224,98,90,0.55)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(224,98,90,0.65)]"
          >
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="nc-shine-card w-full max-w-[420px]"
      data-fb-label="Carte auth · Nouveau mot de passe"
    >
      <div className="nc-shine-card__inner flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h2
            className="text-[18px] font-semibold text-[var(--color-text-primary)]"
            data-fb-label="Titre Nouveau mot de passe · Formulaire nouveau mot de passe"
          >
            Nouveau mot de passe
          </h2>
          <p className="text-[14px] text-[var(--color-text-secondary)]">
            Choisis un mot de passe d&apos;au moins 8 caractères.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          noValidate
          data-fb-label="Formulaire · Formulaire nouveau mot de passe"
        >
          <PasswordField
            id="password"
            label="Nouveau mot de passe"
            autoComplete="new-password"
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            disabled={isPending}
            error={fieldErrors.password}
            hint="8 caractères minimum"
            context="Formulaire nouveau mot de passe"
          />
          <PasswordField
            id="confirmPassword"
            label="Confirmer le mot de passe"
            autoComplete="new-password"
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            disabled={isPending}
            error={fieldErrors.confirmPassword}
            context="Formulaire nouveau mot de passe"
          />

          <button
            type="submit"
            disabled={isPending}
            data-fb-label="Bouton Mettre à jour · Formulaire nouveau mot de passe"
            className="nc-btn-shine group flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(224,98,90,0.55)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(224,98,90,0.65)] active:translate-y-0 active:shadow-[0_6px_16px_-6px_rgba(224,98,90,0.55)] disabled:cursor-not-allowed disabled:opacity-80"
          >
            <span className="relative z-10 flex items-center gap-2">
              {isPending && <LoaderCircle className="size-4 animate-spin" />}
              {isPending ? "Mise à jour…" : "Mettre à jour"}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  show,
  onToggle,
  hint,
  disabled,
  error,
  context,
}: {
  id: string;
  label: string;
  autoComplete?: string;
  show: boolean;
  onToggle: () => void;
  hint?: string;
  disabled?: boolean;
  error?: string;
  context: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[14px] font-medium text-[var(--color-text-secondary)]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          data-fb-label={`Champ ${label} · ${context}`}
          className="nc-input pr-12 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          data-fb-label={`Bouton Afficher le mot de passe · ${context}`}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <p className="text-[13px] text-[var(--color-brand)]">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">{hint}</p>
      ) : null}
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
