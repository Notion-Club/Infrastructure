"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GoogleButton } from "./GoogleButton";

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

// Délai du mock submit (donne le temps de voir l'état loading).
const MOCK_AUTH_DELAY_MS = 600;

// Cible post-auth — sera remplacée par la vraie redirection à l'étape Supabase.
const HOME_PATH = "/dashboard";

export function AuthCard({ state = "login-empty", onStateChange }: AuthCardProps) {
  const router = useRouter();
  const mode: AuthMode = state.startsWith("signup") ? "signup" : "login";
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  const isLoading = pending || state === "signup-loading";
  const hasError = state === "login-error";

  function setMode(next: AuthMode) {
    if (next === mode || pending) return;
    onStateChange?.(next === "signup" ? "signup-empty" : "login-empty");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, MOCK_AUTH_DELAY_MS));
    router.push(HOME_PATH);
  }

  async function handleGoogle() {
    if (pending) return;
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, MOCK_AUTH_DELAY_MS));
    router.push(HOME_PATH);
  }

  return (
    <div className="nc-shine-card w-full max-w-[420px]">
      <div className="nc-shine-card__inner flex flex-col gap-6">
        <ModeToggle mode={mode} onChange={setMode} disabled={pending} />

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

          {hasError && (
            <ErrorPill message="Email ou mot de passe incorrect" />
          )}

          {mode === "login" ? (
            <LoginFields
              disabled={isLoading}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
            />
          ) : (
            <SignupFields
              disabled={isLoading}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
            />
          )}

          <SubmitButton mode={mode} loading={isLoading} />
        </form>
      </div>
    </div>
  );
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
                ? "bg-white text-[var(--color-text-primary)] shadow-[var(--nc-shadow-3)]"
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
}: {
  disabled: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
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
      />
      <PasswordField
        id="password"
        label="Mot de passe"
        autoComplete="current-password"
        show={showPassword}
        onToggle={onTogglePassword}
        disabled={disabled}
        rightAction={
          <Link
            href="#"
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
}: {
  disabled: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
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
        />
        <Field
          id="lastName"
          label="Nom"
          type="text"
          placeholder="Gouman"
          autoComplete="family-name"
          required
          disabled={disabled}
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
      />
      <PasswordField
        id="password"
        label="Mot de passe"
        autoComplete="new-password"
        show={showPassword}
        onToggle={onTogglePassword}
        disabled={disabled}
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
}: {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
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
        className="nc-input disabled:cursor-not-allowed disabled:opacity-60"
      />
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
}: {
  id: string;
  label: string;
  autoComplete?: string;
  show: boolean;
  onToggle: () => void;
  hint?: string;
  rightAction?: React.ReactNode;
  disabled?: boolean;
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
      {hint && (
        <p className="text-[13px] text-[var(--color-text-muted)]">{hint}</p>
      )}
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
