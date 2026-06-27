"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { KeyOnRing, LockCircleDotted } from "@/shared/components/icons";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { GoogleLogo } from "@/shared/components/ui/GoogleButton";
import { GoogleButton } from "@/shared/components/ui/GoogleButton";
import {
  updatePasswordWithReauthAction,
  linkGoogleIdentityAction,
} from "@/modules/settings";
import { SettingsCard } from "./SettingsCard";
import type { AuthIdentity, AuthUserShape } from "./types";

type SecuritySectionProps = {
  user: AuthUserShape;
  isMocked: boolean;
  embedded?: boolean;
};

const MIN_PASSWORD_LENGTH = 8;

export function SecuritySection({
  user,
  isMocked,
  embedded = false,
}: SecuritySectionProps) {
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
      iconNode={<KeyOnRing size={20} />}
      description="Gère tes méthodes de connexion au Notion Club"
      fbLabel="Section sécurité · Réglages"
      embedded={embedded}
    >
      {emailIdentity && <PasswordChangeBlock isMocked={isMocked} />}
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
            <LockCircleDotted size={18} />
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
    </div>
  );
}

/* ------------------------- Google identity ------------------------- */

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
  // État local du lien Google : initialisé depuis la prop, mais piloté
  // localement après une dissociation réussie pour que le CTA se mette à jour
  // immédiatement (la prop `googleIdentity`, elle, ne se rafraîchit qu'au
  // prochain fetch de session côté parent). Resynchronisé si la prop change
  // via le pattern React « ajuster l'état pendant le rendu » (pas d'effet →
  // respecte la règle react-hooks/set-state-in-effect du repo).
  const [linked, setLinked] = useState<AuthIdentity | null>(googleIdentity);
  const [syncedFrom, setSyncedFrom] = useState(googleIdentity);
  if (syncedFrom !== googleIdentity) {
    setSyncedFrom(googleIdentity);
    setLinked(googleIdentity);
  }

  async function linkGoogle() {
    if (pending) return;
    setPending(true);
    try {
      if (isMocked) {
        toast.info("Connectez-vous pour associer un compte Google.");
        setPending(false);
        return;
      }
      // Server action : initialise le flow OAuth (PKCE) et redirige vers Google
      // avec redirectTo=/auth/callback?next=/settings → retour sur /settings
      // (et non /login). En cas de succès, la fonction redirige (ne revient
      // jamais ici) ; sinon elle renvoie une erreur à afficher.
      const result = await linkGoogleIdentityAction();
      if (result && !result.ok) {
        toast.error(result.message);
        setPending(false);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Impossible de connecter le compte Google",
      );
      setPending(false);
    }
  }

  async function unlinkGoogle() {
    if (!linked || pending) return;
    if (!hasOtherIdentity && !confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    try {
      if (isMocked) {
        toast.info("Connectez-vous pour dissocier votre compte Google.");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.unlinkIdentity(
        linked as Parameters<typeof supabase.auth.unlinkIdentity>[0],
      );
      if (error) throw error;
      // MAJ immédiate du front : on bascule l'état local → le CTA « Connecter
      // avec Google » réapparaît avec son animation de reveal.
      setLinked(null);
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

  const googleEmail = linked ? getGoogleEmail(linked) : null;

  return (
    <div
      data-fb-label="Bloc Google · Section sécurité"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      {/* Connexion Google : méthode d'authentification, placée sous le bloc
          mot de passe (le `key` rejoue l'animation de reveal au basculement). */}
      {!linked ? (
        <div key="google-unlinked" className="nc-cta-reveal">
          <GoogleButton
            label="Connecter avec Google"
            loading={pending}
            onClick={linkGoogle}
          />
        </div>
      ) : (
        <div key="google-linked" className="nc-cta-reveal">
          <IntegrationCard
            logo={<GoogleLogo className="size-5" />}
            title="Connexion avec Google"
            subtitle={googleEmail}
            action={
              <button
                type="button"
                onClick={unlinkGoogle}
                disabled={pending}
                data-fb-label="Bouton Déconnecter Google · Section sécurité"
                style={{
                  padding: "8px 14px",
                  borderRadius: 9999,
                  border: "1px solid var(--color-border-default)",
                  background: "var(--color-surface-card)",
                  color: "var(--color-text-primary)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: pending ? "not-allowed" : "pointer",
                  opacity: pending ? 0.6 : 1,
                }}
              >
                {pending ? "…" : "Déconnecter"}
              </button>
            }
          />
        </div>
      )}

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

// Carte d'intégration générique (logo + titre + sous-titre optionnel + action
// à droite). Reprend le design de l'ancienne carte Google connectée.
export function IntegrationCard({
  logo,
  title,
  subtitle,
  action,
}: {
  logo: React.ReactNode;
  title: string;
  subtitle?: string | null;
  action: React.ReactNode;
}) {
  return (
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
      {logo}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </p>
        {subtitle && (
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
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
