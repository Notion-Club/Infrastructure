"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { SettingsCard, SettingsDivider } from "./SettingsCard";
import type { AuthIdentity, AuthUserShape } from "./types";

type SecuritySectionProps = {
  user: AuthUserShape;
  isMocked: boolean;
};

const MIN_PASSWORD_LENGTH = 8;

export function SecuritySection({ user, isMocked }: SecuritySectionProps) {
  const { emailIdentity, googleIdentity } = useMemo(() => {
    const list = user.identities ?? [];
    return {
      emailIdentity: list.find((i) => i.provider === "email") ?? null,
      googleIdentity: list.find((i) => i.provider === "google") ?? null,
    };
  }, [user.identities]);

  return (
    <SettingsCard
      title="Sécurité"
      description="Gérez votre mot de passe et vos méthodes de connexion."
    >
      {emailIdentity && (
        <>
          <PasswordChangeForm isMocked={isMocked} />
          <SettingsDivider />
        </>
      )}
      <GoogleIdentityBlock
        googleIdentity={googleIdentity}
        hasOtherIdentity={Boolean(emailIdentity)}
        isMocked={isMocked}
      />
    </SettingsCard>
  );
}

/* ------------------------- Password change ------------------------- */

function PasswordChangeForm({ isMocked }: { isMocked: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const error = useMemo<string | null>(() => {
    if (!next && !confirm && !current) return null;
    if (next && next.length < MIN_PASSWORD_LENGTH) {
      return `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
    }
    if (next && current && next === current) {
      return "Le nouveau mot de passe doit être différent de l'ancien.";
    }
    if (confirm && next && confirm !== next) {
      return "La confirmation ne correspond pas au nouveau mot de passe.";
    }
    return null;
  }, [current, next, confirm]);

  const canSubmit =
    current.length > 0 &&
    next.length >= MIN_PASSWORD_LENGTH &&
    confirm === next &&
    next !== current &&
    !submitting;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isMocked) {
        await new Promise((r) => setTimeout(r, 500));
        toast.success("Mot de passe mis à jour (démo)");
      } else {
        const supabase = createSupabaseBrowserClient();
        const { error: updateError } = await supabase.auth.updateUser({
          password: next,
        });
        if (updateError) throw updateError;
        toast.success("Mot de passe mis à jour");
      }
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors du changement de mot de passe";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text-primary)",
        }}
      >
        Changer mon mot de passe
      </h3>
      <PasswordField
        id="current-password"
        label="Ancien mot de passe"
        value={current}
        onChange={setCurrent}
        show={show}
        onToggleShow={() => setShow((s) => !s)}
        autoComplete="current-password"
      />
      <PasswordField
        id="new-password"
        label="Nouveau mot de passe"
        value={next}
        onChange={setNext}
        show={show}
        onToggleShow={() => setShow((s) => !s)}
        autoComplete="new-password"
        hint={`Minimum ${MIN_PASSWORD_LENGTH} caractères`}
      />
      <PasswordField
        id="confirm-password"
        label="Confirmer le nouveau mot de passe"
        value={confirm}
        onChange={setConfirm}
        show={show}
        onToggleShow={() => setShow((s) => !s)}
        autoComplete="new-password"
      />
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-brand)",
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 9999,
            border: "none",
            background: "var(--color-brand)",
            color: "white",
            fontWeight: 600,
            fontSize: 14,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
            transition: "opacity 150ms ease",
            boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
          }}
        >
          {submitting && <LoaderCircle size={14} className="animate-spin" />}
          {submitting ? "Mise à jour…" : "Mettre à jour le mot de passe"}
        </button>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-secondary)",
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="nc-input"
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          style={{
            position: "absolute",
            top: "50%",
            right: 10,
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 6,
            color: "var(--color-text-muted)",
            borderRadius: 6,
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/* ------------------------- Google identity ------------------------- */

function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.12a6.6 6.6 0 0 1 0-4.24V7.04H2.18a11.07 11.07 0 0 0 0 9.92l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.16-3.16C17.45 2.14 14.97 1 12 1 7.69 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function getGoogleEmail(identity: AuthIdentity): string | null {
  const data = identity.identity_data;
  if (!data) return null;
  const candidate = data["email"];
  return typeof candidate === "string" ? candidate : null;
}

function GoogleIdentityBlock({
  googleIdentity,
  hasOtherIdentity,
  isMocked,
}: {
  googleIdentity: AuthIdentity | null;
  hasOtherIdentity: boolean;
  isMocked: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function linkGoogle() {
    if (pending) return;
    setPending(true);
    try {
      if (isMocked) {
        await new Promise((r) => setTimeout(r, 400));
        toast.info("Connectez-vous pour associer un compte Google.");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.linkIdentity({ provider: "google" });
      if (error) throw error;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de connecter le compte Google";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function unlinkGoogle() {
    if (!googleIdentity || pending) return;
    if (!hasOtherIdentity && !confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    try {
      if (isMocked) {
        await new Promise((r) => setTimeout(r, 400));
        toast.info("Connectez-vous pour dissocier votre compte Google.");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      // unlinkIdentity expects a UserIdentity record from getUserIdentities.
      const { error } = await supabase.auth.unlinkIdentity(
        googleIdentity as Parameters<typeof supabase.auth.unlinkIdentity>[0],
      );
      if (error) throw error;
      toast.success("Compte Google dissocié");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de dissocier le compte Google";
      toast.error(message);
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  if (!googleIdentity) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          Connexion avec Google
        </h3>
        <button
          type="button"
          onClick={linkGoogle}
          disabled={pending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "12px 20px",
            borderRadius: 12,
            border: "1px solid var(--color-border-default)",
            background: "white",
            color: "var(--color-text-primary)",
            fontSize: 14,
            fontWeight: 500,
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.6 : 1,
            transition: "background 150ms ease",
          }}
        >
          {pending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <GoogleLogo />
          )}
          Connecter avec Google
        </button>
      </div>
    );
  }

  const googleEmail = getGoogleEmail(googleIdentity);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text-primary)",
        }}
      >
        Connexion avec Google
      </h3>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 14,
          borderRadius: 12,
          border: "1px solid var(--color-border-default)",
          background: "var(--color-surface-raised)",
        }}
      >
        <GoogleLogo size={22} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-primary)",
            }}
          >
            Google
          </p>
          {googleEmail && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--color-text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {googleEmail}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={unlinkGoogle}
          disabled={pending}
          style={{
            padding: "8px 14px",
            borderRadius: 9999,
            border: "1px solid var(--color-border-default)",
            background: "white",
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 500,
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "…" : "Déconnecter"}
        </button>
      </div>
      {confirming && (
        <div
          role="alert"
          style={{
            padding: 12,
            borderRadius: 10,
            background: "rgba(224,98,90,0.08)",
            border: "1px solid rgba(224,98,90,0.25)",
            fontSize: 12,
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Attention : si vous dissociez Google sans avoir défini de mot de passe,
          vous ne pourrez plus vous connecter.
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--color-border-default)",
                background: "white",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={unlinkGoogle}
              disabled={pending}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                background: "var(--color-brand)",
                color: "white",
                fontSize: 12,
                fontWeight: 600,
                cursor: pending ? "not-allowed" : "pointer",
              }}
            >
              Confirmer la dissociation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
