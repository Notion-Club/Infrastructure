"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { GoogleLogo } from "@/shared/components/ui/GoogleButton";
import { GoogleButton } from "@/shared/components/ui/GoogleButton";
import { updatePasswordWithReauthAction } from "@/modules/settings";
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
      fbLabel="Section sécurité · Réglages"
    >
      {emailIdentity && (
        <>
          <PasswordChangeBlock isMocked={isMocked} />
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

/* ------------------------- Password change (collapsible) ------------------------- */

function PasswordChangeBlock({ isMocked }: { isMocked: boolean }) {
  const [open, setOpen] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const [innerHeight, setInnerHeight] = useState(0);

  useEffect(() => {
    if (!innerRef.current) return;
    const el = innerRef.current;
    const update = () => setInnerHeight(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // OPS-49 — fusion visuelle des 2 blocs (trigger + form) dans un seul
  // conteneur bordé. Le trigger n'a plus de border propre ; on ajoute juste
  // un filet bas (border-bottom) quand le panel est ouvert pour séparer le
  // header du formulaire à l'intérieur du même bloc.
  return (
    <div
      className="nc-pw-modal"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        border: "1px solid var(--color-border-default)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-fb-label="Bouton changer mot de passe · Section sécurité"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          border: "none",
          background: "transparent",
          borderBottom: open
            ? "1px solid var(--color-border-default)"
            : "1px solid transparent",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          transition: "border-color 150ms ease",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-default)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            <KeyRound size={14} />
          </span>
          <span
            style={{
              display: "inline-flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              Changer mon mot de passe
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
              }}
            >
              Minimum {MIN_PASSWORD_LENGTH} caractères.
            </span>
          </span>
        </span>
        <ChevronDown
          size={16}
          style={{
            color: "var(--color-text-muted)",
            transition: "transform 220ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      <div
        style={{
          overflow: "hidden",
          transition:
            "max-height 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
          maxHeight: open ? innerHeight + 8 : 0,
          opacity: open ? 1 : 0,
        }}
      >
        <div ref={innerRef} style={{ padding: "14px 14px 16px" }}>
          <PasswordChangeForm
            isMocked={isMocked}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}

function PasswordChangeForm({
  isMocked,
  onSuccess,
}: {
  isMocked: boolean;
  onSuccess: () => void;
}) {
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
        toast.success("Mot de passe mis à jour (démo)");
        setCurrent("");
        setNext("");
        setConfirm("");
        onSuccess();
        return;
      }

      const result = await updatePasswordWithReauthAction({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Mot de passe mis à jour");
      setCurrent("");
      setNext("");
      setConfirm("");
      onSuccess();
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
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
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
          data-fb-label="Bouton Mettre à jour mot de passe · Section sécurité"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 9999,
            border: "none",
            background: "var(--color-brand)",
            color: "white",
            fontWeight: 600,
            fontSize: 13,
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
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
          data-fb-label={`Champ ${label} · Section sécurité`}
          className="nc-input nc-pw-input"
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
    </div>
  );
}

/* ------------------------- Google identity ------------------------- */

const SUPPORT_EMAIL = "theo@gouman.fr";

// #134 — Traduction des erreurs Supabase OAuth en messages clairs côté UI.
// On ne montre JAMAIS le message technique brut (ex. « Manual Linking is
// Disabled ») : on mappe les cas connus, sinon on retombe sur un message
// générique actionnable (« réessaie »). Le détail technique reste loggué en
// console pour le debug.
function humanizeGoogleError(
  err: unknown,
  context: "link" | "unlink",
): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (raw) console.warn(`[google-${context}] erreur brute:`, raw);
  const low = raw.toLowerCase();

  if (low.includes("manual linking is disabled")) {
    return "L'association de comptes Google n'est pas disponible pour le moment. Réessaie plus tard, ou contacte le support si le problème persiste.";
  }
  if (low.includes("already") && low.includes("identit")) {
    return "Ce compte Google est déjà associé à un autre profil Notion Club.";
  }
  if (
    low.includes("last identity") ||
    low.includes("single identity") ||
    low.includes("cannot unlink")
  ) {
    return "Impossible de dissocier Google : c'est ta seule méthode de connexion. Définis d'abord un mot de passe.";
  }
  if (
    low.includes("network") ||
    low.includes("failed to fetch") ||
    low.includes("timeout")
  ) {
    return "Connexion impossible. Vérifie ton accès internet et réessaie.";
  }
  return context === "link"
    ? "Impossible de connecter le compte Google pour le moment. Réessaie dans un instant."
    : "Impossible de dissocier le compte Google pour le moment. Réessaie dans un instant.";
}

// #134 — Encart d'erreur clair + actions (réessayer / contacter le support).
function GoogleErrorNotice({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div
      role="alert"
      data-fb-label="Erreur Google · Section sécurité"
      style={{
        display: "flex",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        background: "rgba(224,98,90,0.08)",
        border: "1px solid rgba(224,98,90,0.25)",
      }}
    >
      <AlertCircle
        size={16}
        style={{ color: "var(--color-brand)", flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 8,
              border: "none",
              background: "var(--color-brand)",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
              cursor: retrying ? "not-allowed" : "pointer",
              opacity: retrying ? 0.6 : 1,
            }}
          >
            {retrying && <LoaderCircle size={12} className="animate-spin" />}
            Réessayer
          </button>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              "Problème connexion Google — Notion Club",
            )}`}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-text-muted)",
              textDecoration: "underline",
            }}
          >
            Contacter le support
          </a>
        </div>
      </div>
    </div>
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Erreur affichée en clair sous le bloc (pas seulement en toast) avec une
  // action de reprise. `context` sert au bouton « Réessayer ».
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function linkGoogle() {
    if (pending) return;
    setErrorMsg(null);
    setPending(true);
    try {
      if (isMocked) {
        toast.info("Connectez-vous pour associer un compte Google.");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.linkIdentity({ provider: "google" });
      if (error) throw error;
      // En cas de succès, Supabase redirige vers Google : pas de suite ici.
    } catch (err) {
      const message = humanizeGoogleError(err, "link");
      setErrorMsg(message);
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
    setErrorMsg(null);
    setPending(true);
    try {
      if (isMocked) {
        toast.info("Connectez-vous pour dissocier votre compte Google.");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.unlinkIdentity(
        googleIdentity as Parameters<typeof supabase.auth.unlinkIdentity>[0],
      );
      if (error) throw error;
      toast.success("Compte Google dissocié");
      setConfirming(false);
      // Rafraîchit la page : le bloc Google disparaît une fois l'identité
      // retirée (les identités sont chargées côté serveur via le layout).
      router.refresh();
    } catch (err) {
      const message = humanizeGoogleError(err, "unlink");
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const errorBox = errorMsg ? (
    <GoogleErrorNotice
      message={errorMsg}
      onRetry={() => {
        setErrorMsg(null);
        if (googleIdentity) unlinkGoogle();
        else linkGoogle();
      }}
      retrying={pending}
    />
  ) : null;

  if (!googleIdentity) {
    return (
      <div
        data-fb-label="Bloc Google · Section sécurité"
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
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
        <GoogleButton
          label="Connecter avec Google"
          loading={pending}
          onClick={linkGoogle}
        />
        {errorBox}
      </div>
    );
  }

  const googleEmail = getGoogleEmail(googleIdentity);

  return (
    <div
      data-fb-label="Bloc Google · Section sécurité"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
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
          border: "1px dashed var(--color-border-default)",
          background: "var(--color-surface-raised)",
        }}
      >
        <GoogleLogo className="size-5" />
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
          aria-busy={pending}
          data-fb-label="Bouton Déconnecter Google · Section sécurité"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 9999,
            border: "1px solid var(--color-border-default)",
            background: "var(--color-surface-card)",
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 500,
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.6 : 1,
            transition: "opacity 150ms ease",
          }}
        >
          {pending && <LoaderCircle size={13} className="animate-spin" />}
          {pending ? "Déconnexion…" : "Déconnecter"}
        </button>
      </div>
      {errorBox}
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
                background: "var(--color-surface-card)",
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
