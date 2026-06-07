"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  deleteAccountAction,
} from "@/modules/settings";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { SettingsCard } from "./SettingsCard";

type DangerZoneProps = {
  isMocked: boolean;
};

export function DangerZone({ isMocked }: DangerZoneProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Redirect happens anyway — login page handles a stale session.
    } finally {
      router.push("/login");
    }
  }

  return (
    <SettingsCard
      title="Zone de danger"
      description="Déconnecte-toi de cet appareil, ou supprime définitivement ton compte. Toutes les données identifiantes seront anonymisées et tes accès révoqués."
      tone="danger"
      fbLabel="Zone de danger · Réglages"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          data-fb-label="Bouton Se déconnecter · Zone de danger"
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 9999,
            border: "1px solid var(--color-border-default)",
            background: "var(--color-surface-raised)",
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: signingOut ? "wait" : "pointer",
            opacity: signingOut ? 0.6 : 1,
            transition: "background 150ms ease",
          }}
          className="hover:bg-[var(--color-surface-card)]"
        >
          {signingOut ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <LogOut size={14} />
          )}
          {signingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          data-fb-label="Bouton Supprimer mon compte · Zone de danger"
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 9999,
            border: "1px solid rgba(224,98,90,0.4)",
            background: "var(--color-surface-card)",
            color: "var(--color-brand)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
          className="hover:bg-[rgba(224,98,90,0.06)]"
        >
          <Trash2 size={14} />
          Supprimer mon compte
        </button>
      </div>
      {modalOpen && (
        <DeleteAccountModal
          isMocked={isMocked}
          onClose={() => setModalOpen(false)}
        />
      )}
    </SettingsCard>
  );
}

// ============================================================================
// Modal de confirmation — re-auth password + texte de confirmation
// ============================================================================
function DeleteAccountModal({
  isMocked,
  onClose,
}: {
  isMocked: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Lock body scroll while modal is open.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Escape closes the modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const canSubmit =
    password.length > 0 &&
    confirmation === ACCOUNT_DELETION_CONFIRMATION_PHRASE &&
    !submitting;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isMocked) {
        await new Promise((r) => setTimeout(r, 600));
        toast.info("Suppression simulée (démo) — connectez-vous pour de vrai.");
        onClose();
        return;
      }

      const result = await deleteAccountAction({ password, confirmation });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // Redirige vers /login avec un flag pour afficher un toast de
      // confirmation côté page login.
      router.push("/login?account_deleted=1");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors de la suppression du compte.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmer la suppression du compte"
      data-fb-label="Modale suppression compte · Zone de danger"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--color-surface-card)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid var(--color-border-default)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Trash2 size={18} style={{ color: "var(--color-brand)" }} />
            Supprimer le compte
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13,
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Cette action est <strong>définitive</strong>. Tes données
            identifiantes seront anonymisées immédiatement et tu ne pourras
            plus te connecter avec ce compte.
          </p>
        </header>

        <div
          style={{
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              htmlFor="delete-account-password"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-secondary)",
              }}
            >
              Mot de passe actuel
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="delete-account-password"
                type={showPassword ? "text" : "password"}
                data-fb-label="Champ Mot de passe · Modale suppression compte"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
                className="nc-input"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                disabled={submitting}
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 10,
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  padding: 6,
                  color: "var(--color-text-muted)",
                  borderRadius: 6,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmation phrase */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              htmlFor="delete-account-confirmation"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-secondary)",
              }}
            >
              Tape{" "}
              <code
                style={{
                  background: "rgba(224,98,90,0.08)",
                  color: "var(--color-brand)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                {ACCOUNT_DELETION_CONFIRMATION_PHRASE}
              </code>{" "}
              pour confirmer
            </label>
            <input
              id="delete-account-confirmation"
              type="text"
              data-fb-label="Champ Confirmation · Modale suppression compte"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={submitting}
              className="nc-input"
              placeholder={ACCOUNT_DELETION_CONFIRMATION_PHRASE}
              style={{ letterSpacing: "0.04em" }}
            />
          </div>
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "14px 20px",
            borderTop: "1px solid var(--color-border-default)",
            background: "var(--color-surface-raised)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            data-fb-label="Bouton Annuler · Modale suppression compte"
            style={{
              padding: "9px 18px",
              borderRadius: 9999,
              border: "1px solid var(--color-border-default)",
              background: "var(--color-surface-card)",
              color: "var(--color-text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            data-fb-label="Bouton Supprimer définitivement · Modale suppression compte"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              borderRadius: 9999,
              border: "none",
              background: "var(--color-brand)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.55,
              boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
            }}
          >
            {submitting && <LoaderCircle size={14} className="animate-spin" />}
            {submitting ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </footer>
      </form>
    </div>
  );
}
