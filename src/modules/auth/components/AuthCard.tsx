"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import type { ZodIssue } from "zod";

import { cn } from "@/shared/lib/utils";
import { GoogleButton } from "./GoogleButton";
import {
  signinSchema,
  signupSchema,
} from "@/modules/auth/lib/validation";
import {
  signInAction,
  signInWithGoogleAction,
  signUpAction,
} from "@/modules/auth/server/actions";

export type AuthMode = "login" | "signup";
export type AuthCardState =
  | "login-empty"
  | "login-error"
  | "signup-empty"
  | "signup-loading";

type AuthCardProps = {
  state?: AuthCardState;
  onStateChange?: (state: AuthCardState) => void;
};

const HOME_PATH = "/dashboard";

// Messages affichés dans l'ErrorPill quand on revient sur /login après un échec OAuth.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Connexion Google annulée",
  oauth_no_code: "Réponse Google incomplète",
  oauth_exchange_failed: "Impossible de finaliser Google",
  oauth_init_failed: "Impossible de démarrer Google",
};

type FieldErrors = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
};

export function AuthCard({ state = "login-empty", onStateChange }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: AuthMode = state.startsWith("signup") ? "signup" : "login";
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Si on revient sur /login après un échec OAuth Google (?error=…), l'erreur est
  // dérivée pendant le render. Pas d'useEffect : React 19 décourage setState
  // dans un effect quand on peut calculer l'état au render.
  const oauthErrorParam = searchParams.get("error");
  const oauthError =
    oauthErrorParam && OAUTH_ERROR_MESSAGES[oauthErrorParam]
      ? OAUTH_ERROR_MESSAGES[oauthErrorParam]
      : null;

  const isLoading = isPending || state === "signup-loading";

  // Si l'utilisateur clique "Continuer avec Google" puis ferme l'onglet Google
  // sans aller au bout, le navigateur restore /login depuis le bfcache avec
  // isPending=true gelé — la promesse de la transition est morte avec le
  // redirect, le loader resterait sinon bloqué indéfiniment. On reload dès
  // qu'on détecte ce retour bfcache pendant qu'une transition était en cours.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted && isPending) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [isPending]);

  const errorMessage =
    submitError ??
    oauthError ??
    (state === "login-error" ? "Identifiants incorrects" : null);
  const hasError = errorMessage !== null;

  function setMode(next: AuthMode) {
    if (next === mode || isPending) return;
    setFieldErrors({});
    setSubmitError(null);
    onStateChange?.(next === "signup" ? "signup-empty" : "login-empty");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const formData = new FormData(event.currentTarget);
    setFieldErrors({});
    setSubmitError(null);

    if (mode === "login") {
      const raw = {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      };
      const parsed = signinSchema.safeParse(raw);
      if (!parsed.success) {
        setFieldErrors(extractFieldErrors(parsed.error.issues));
        return;
      }

      startTransition(async () => {
        const result = await signInAction(parsed.data);
        if (!result.ok) {
          setSubmitError(result.message);
          onStateChange?.("login-error");
          return;
        }
        router.push(HOME_PATH);
      });
      return;
    }

    // Signup
    const raw = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
    };
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      setFieldErrors(extractFieldErrors(parsed.error.issues));
      return;
    }

    startTransition(async () => {
      const result = await signUpAction(parsed.data);
      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }
      router.push(HOME_PATH);
    });
  }

  function handleGoogle() {
    if (isPending) return;
    setSubmitError(null);
    startTransition(async () => {
      // signInWithGoogleAction throw NEXT_REDIRECT, le browser part avant toute suite.
      await signInWithGoogleAction();
    });
  }

  return (
    <div className="nc-shine-card w-full max-w-[420px]">
      <div className="nc-shine-card__inner flex flex-col gap-6">
        <ModeToggle mode={mode} onChange={setMode} disabled={isPending} />

        <form
          key={mode}
          onSubmit={handleSubmit}
          className="nc-mode-in flex flex-col gap-5"
          noValidate
        >
          <GoogleButton
            label={
              mode === "login"
                ? "Continuer avec Google"
                : "S'inscrire avec Google"
            }
            loading={isLoading}
            onClick={handleGoogle}
          />

          <Divider />

          {hasError && errorMessage && <ErrorPill message={errorMessage} />}

          {mode === "login" ? (
            <LoginFields
              disabled={isLoading}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
              fieldErrors={fieldErrors}
            />
          ) : (
            <SignupFields
              disabled={isLoading}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
              fieldErrors={fieldErrors}
            />
          )}

          <SubmitButton mode={mode} loading={isLoading} />
        </form>
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

/* -------------------- subcomponents -------------------- */

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Mode d'authentification"
      className="relative grid grid-cols-2 gap-1 rounded-full bg-[var(--color-surface-raised)] p-1"
    >
      {(["login", "signup"] as const).map((value) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(value)}
            className={cn(
              "relative z-10 rounded-full px-4 py-2 text-[14px] font-semibold transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? "bg-[var(--nc-segmented-active-bg)] text-[var(--nc-segmented-active-text)] shadow-[var(--nc-shadow-3)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
            )}
          >
            {value === "login" ? "Login" : "Créer compte"}
          </button>
        );
      })}
    </div>
  );
}

function Divider() {
  return (
    <div className="my-1 flex items-center gap-3 text-[14px] text-[var(--color-text-muted)]">
      <span className="h-px flex-1 bg-[var(--color-border-default)]" />
      ou
      <span className="h-px flex-1 bg-[var(--color-border-default)]" />
    </div>
  );
}

function ErrorPill({ message }: { message: string }) {
  return (
    <div className="inline-flex items-center gap-2 self-start rounded-full bg-[rgba(224,98,90,0.1)] px-3 py-1.5 text-[14px] font-semibold text-[var(--color-brand)]">
      <span className="nc-blink-dot" aria-hidden />
      {message}
    </div>
  );
}

function LoginFields({
  disabled,
  showPassword,
  onTogglePassword,
  fieldErrors,
}: {
  disabled: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
  fieldErrors: FieldErrors;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field
        id="email"
        label="Email"
        type="email"
        placeholder="toi@exemple.com"
        autoComplete="email"
        required
        disabled={disabled}
        error={fieldErrors.email}
      />
      <PasswordField
        id="password"
        label="Mot de passe"
        autoComplete="current-password"
        show={showPassword}
        onToggle={onTogglePassword}
        disabled={disabled}
        error={fieldErrors.password}
        rightAction={
          <Link
            href="/reset-password"
            className="text-[14px] font-medium text-[var(--color-brand)] hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        }
      />
    </div>
  );
}

function SignupFields({
  disabled,
  showPassword,
  onTogglePassword,
  fieldErrors,
}: {
  disabled: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
  fieldErrors: FieldErrors;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="firstName"
          label="Prénom"
          type="text"
          placeholder="Théo"
          autoComplete="given-name"
          required
          disabled={disabled}
          error={fieldErrors.firstName}
        />
        <Field
          id="lastName"
          label="Nom"
          type="text"
          placeholder="Gouman"
          autoComplete="family-name"
          required
          disabled={disabled}
          error={fieldErrors.lastName}
        />
      </div>
      <Field
        id="email"
        label="Email"
        type="email"
        placeholder="toi@exemple.com"
        autoComplete="email"
        required
        disabled={disabled}
        error={fieldErrors.email}
      />
      <PasswordField
        id="password"
        label="Mot de passe"
        autoComplete="new-password"
        show={showPassword}
        onToggle={onTogglePassword}
        disabled={disabled}
        error={fieldErrors.password}
        hint="8 caractères minimum"
      />
    </div>
  );
}

function Field({
  id,
  label,
  type,
  placeholder,
  autoComplete,
  required,
  disabled,
  error,
}: {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2">
      <span className="text-[14px] font-medium text-[var(--color-text-secondary)]">
        {label}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className="nc-input disabled:cursor-not-allowed disabled:opacity-60"
      />
      {error && (
        <p className="text-[13px] text-[var(--color-brand)]">{error}</p>
      )}
    </label>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  show,
  onToggle,
  hint,
  rightAction,
  disabled,
  error,
}: {
  id: string;
  label: string;
  autoComplete?: string;
  show: boolean;
  onToggle: () => void;
  hint?: string;
  rightAction?: React.ReactNode;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-[14px] font-medium text-[var(--color-text-secondary)]"
        >
          {label}
        </label>
        {rightAction}
      </div>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          minLength={1}
          aria-invalid={error ? true : undefined}
          className="nc-input pr-12 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
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

function SubmitButton({
  mode,
  loading,
}: {
  mode: AuthMode;
  loading: boolean;
}) {
  const idleLabel = mode === "login" ? "Se connecter" : "Créer mon compte";
  const loadingLabel = mode === "login" ? "Connexion…" : "Création en cours…";
  return (
    <button
      type="submit"
      disabled={loading}
      className="nc-btn-shine group flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(224,98,90,0.55)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(224,98,90,0.65)] active:translate-y-0 active:shadow-[0_6px_16px_-6px_rgba(224,98,90,0.55)] disabled:cursor-not-allowed disabled:opacity-80"
    >
      <span className="relative z-10 flex items-center gap-2">
        {loading && <LoaderCircle className="size-4 animate-spin" />}
        {loading ? loadingLabel : idleLabel}
      </span>
    </button>
  );
}
