"use client";

import { useState } from "react";
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

export function AuthCard({ state = "login-empty", onStateChange }: AuthCardProps) {
  const mode: AuthMode = state.startsWith("signup") ? "signup" : "login";
  const isLoading = state === "signup-loading";
  const hasError = state === "login-error";
  const [showPassword, setShowPassword] = useState(false);

  function setMode(next: AuthMode) {
    if (next === mode) return;
    onStateChange?.(next === "signup" ? "signup-empty" : "login-empty");
  }

  return (
    <div className="nc-shine-card w-full max-w-[420px]">
      <div className="nc-shine-card__inner flex flex-col gap-6">
        <ModeToggle mode={mode} onChange={setMode} />

        <div key={mode} className="nc-mode-in flex flex-col gap-5">
          <GoogleButton
            label={
              mode === "login"
                ? "Continuer avec Google"
                : "S'inscrire avec Google"
            }
          />

          <Divider />

          {hasError && (
            <ErrorPill message="Email ou mot de passe incorrect" />
          )}

          {mode === "login" ? (
            <LoginFields
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
            />
          ) : (
            <SignupFields
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
            />
          )}

          <SubmitButton mode={mode} loading={isLoading} />

          <Footer mode={mode} onSwitch={setMode} />
        </div>
      </div>
    </div>
  );
}

/* -------------------- subcomponents -------------------- */

function ModeToggle({
  mode,
  onChange,
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
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
            onClick={() => onChange(value)}
            className={cn(
              "relative z-10 rounded-full px-4 py-2 text-[14px] font-semibold transition-all duration-200 ease-out",
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
  showPassword,
  onTogglePassword,
}: {
  showPassword: boolean;
  onTogglePassword: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field id="email" label="Email" type="email" placeholder="toi@exemple.com" autoComplete="email" />
      <PasswordField
        id="password"
        label="Mot de passe"
        autoComplete="current-password"
        show={showPassword}
        onToggle={onTogglePassword}
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
  showPassword,
  onTogglePassword,
}: {
  showPassword: boolean;
  onTogglePassword: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field id="firstName" label="Prénom" type="text" placeholder="Théo" autoComplete="given-name" />
      <Field id="email" label="Email" type="email" placeholder="toi@exemple.com" autoComplete="email" />
      <PasswordField
        id="password"
        label="Mot de passe"
        autoComplete="new-password"
        show={showPassword}
        onToggle={onTogglePassword}
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
}: {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
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
        className="nc-input"
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
}: {
  id: string;
  label: string;
  autoComplete?: string;
  show: boolean;
  onToggle: () => void;
  hint?: string;
  rightAction?: React.ReactNode;
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
          className="nc-input pr-12"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
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
  const label = mode === "login" ? "Se connecter" : "Créer mon compte";
  return (
    <button
      type="button"
      disabled={loading}
      className="nc-btn-shine group flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(224,98,90,0.55)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(224,98,90,0.65)] active:translate-y-0 active:shadow-[0_6px_16px_-6px_rgba(224,98,90,0.55)] disabled:cursor-not-allowed disabled:opacity-80"
    >
      <span className="relative z-10 flex items-center gap-2">
        {loading && <LoaderCircle className="size-4 animate-spin" />}
        {loading ? "Création en cours…" : label}
      </span>
    </button>
  );
}

function Footer({
  mode,
  onSwitch,
}: {
  mode: AuthMode;
  onSwitch: (mode: AuthMode) => void;
}) {
  if (mode === "login") {
    return (
      <p className="text-center text-[14px] text-[var(--color-text-muted)]">
        Pas encore de compte ?{" "}
        <button
          type="button"
          onClick={() => onSwitch("signup")}
          className="font-semibold text-[var(--color-brand)] hover:underline"
        >
          Créer un compte
        </button>
      </p>
    );
  }
  return (
    <p className="text-center text-[14px] text-[var(--color-text-muted)]">
      Déjà un compte ?{" "}
      <button
        type="button"
        onClick={() => onSwitch("login")}
        className="font-semibold text-[var(--color-brand)] hover:underline"
      >
        Se connecter
      </button>
    </p>
  );
}
