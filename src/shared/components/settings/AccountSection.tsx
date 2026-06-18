"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { updateProfileAction, updateAccountEmailAction } from "@/modules/settings";
import { SettingsCard } from "./SettingsCard";
import { EmailField } from "./EmailField";
import { PhoneField, formatPhone, parsePhone, type PhoneValue } from "./PhoneField";
import type { ProfileRow } from "./types";

// ============================================================================
// AccountSection (#128) — « Réglages compte » : informations PRIVÉES de
// connexion et de facturation (email de login, téléphone).
//
// Le profil PUBLIC (photo, nom d'affichage, username, prénom/nom, bio) vit
// désormais dans l'éditeur de profil (ProfileEditor), accessible depuis le
// menu compte. Cette séparation lève l'ambiguïté de l'ancienne phrase
// « visible dans l'app et utilisé pour facturation » : ici rien n'est public.
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<"email", string>>;

type AccountSectionProps = {
  profile: ProfileRow;
  accountEmail: string;
  isMocked: boolean;
};

export function AccountSection({
  profile,
  accountEmail,
  isMocked,
}: AccountSectionProps) {
  const initial = useMemo(() => {
    return {
      email: accountEmail,
      phone: parsePhone(profile.phone),
    };
  }, [profile, accountEmail]);

  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState<PhoneValue>(initial.phone);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const errors = useMemo<FieldErrors>(() => {
    const e: FieldErrors = {};
    if (email.trim().length === 0) e.email = "L'email est requis.";
    else if (!EMAIL_REGEX.test(email.trim()))
      e.email = "Format d'email invalide.";
    return e;
  }, [email]);
  const hasErrors = Object.keys(errors).length > 0;
  const visibleErrors: FieldErrors = {
    ...(touched.email ? { email: errors.email } : {}),
  };

  const hasChanges = useMemo(() => {
    if (email !== initial.email) return true;
    if (
      phone.countryCode !== initial.phone.countryCode ||
      phone.national.trim() !== initial.phone.national.trim()
    )
      return true;
    return false;
  }, [email, phone, initial]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasChanges || saving) return;
    if (hasErrors) {
      setTouched({ email: true });
      return;
    }
    setSaving(true);
    try {
      if (isMocked) {
        toast.success("Modifications enregistrées (démo)");
        return;
      }

      const phoneText = formatPhone(phone) || null;

      const accountFieldsChanged =
        phone.countryCode !== initial.phone.countryCode ||
        phone.national.trim() !== initial.phone.national.trim();

      if (accountFieldsChanged) {
        const result = await updateProfileAction({
          phone: phoneText,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
      }

      const emailChanged =
        email.trim().toLowerCase() !== accountEmail.trim().toLowerCase();
      if (emailChanged) {
        const result = await updateAccountEmailAction({ newEmail: email });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.info(
          "Un email de confirmation a été envoyé à votre nouvelle adresse.",
        );
      }

      if (accountFieldsChanged || emailChanged) {
        toast.success("Modifications enregistrées");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      title="Mes informations"
      description="C'est avec ces informations que tu te connectes au Notion Club"
      fbLabel="Section compte · Réglages"
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <EmailField
          label="Ton mail"
          value={email}
          error={visibleErrors.email}
          onChange={setEmail}
          onBlur={() => setTouched((p) => ({ ...p, email: true }))}
        />

        <PhoneField
          id="phone"
          label="Numéro de téléphone"
          value={phone}
          onChange={setPhone}
        />

        {hasChanges && (
          <div
            className="nc-mode-in"
            style={{ display: "flex", justifyContent: "flex-end" }}
          >
            <button
              type="submit"
              disabled={saving}
              data-fb-label="Bouton Enregistrer · Section compte"
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
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
                transition: "opacity 150ms ease",
                boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
              }}
            >
              {saving && <LoaderCircle size={14} className="animate-spin" />}
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        )}
      </form>
    </SettingsCard>
  );
}
