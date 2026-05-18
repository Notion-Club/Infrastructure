"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { SettingsCard } from "./SettingsCard";
import { EmailField } from "./EmailField";
import { PhoneField, formatPhone, parsePhone, type PhoneValue } from "./PhoneField";
import type { ProfileRow } from "./types";

type FormValues = {
  display_name: string;
  first_name: string;
  last_name: string;
  phone: PhoneValue;
  email: string;
  notion_email: string;
  use_separate_notion_email: boolean;
};

function profileToForm(profile: ProfileRow, fallbackEmail: string): FormValues {
  const notionEmail = profile.notion_email ?? "";
  const platformEmail = fallbackEmail;
  return {
    display_name: profile.display_name ?? "",
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    phone: parsePhone(profile.phone),
    email: platformEmail,
    notion_email: notionEmail,
    use_separate_notion_email:
      notionEmail.trim().length > 0 &&
      notionEmail.trim().toLowerCase() !== platformEmail.trim().toLowerCase(),
  };
}

type ProfileSectionProps = {
  profile: ProfileRow;
  accountEmail: string;
  isMocked: boolean;
};

export function ProfileSection({
  profile,
  accountEmail,
  isMocked,
}: ProfileSectionProps) {
  const initialValues = useMemo(
    () => profileToForm(profile, accountEmail),
    [profile, accountEmail],
  );
  const [values, setValues] = useState<FormValues>(initialValues);
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(() => {
    if (values.display_name !== initialValues.display_name) return true;
    if (values.first_name !== initialValues.first_name) return true;
    if (values.last_name !== initialValues.last_name) return true;
    if (values.email !== initialValues.email) return true;
    if (
      values.phone.countryCode !== initialValues.phone.countryCode ||
      values.phone.national.trim() !== initialValues.phone.national.trim()
    ) {
      return true;
    }
    if (
      values.use_separate_notion_email !==
      initialValues.use_separate_notion_email
    ) {
      return true;
    }
    if (
      values.use_separate_notion_email &&
      values.notion_email !== initialValues.notion_email
    ) {
      return true;
    }
    return false;
  }, [values, initialValues]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      const phoneText = formatPhone(values.phone);
      const resolvedNotionEmail = values.use_separate_notion_email
        ? values.notion_email.trim() || null
        : null;

      if (isMocked) {
        await new Promise((r) => setTimeout(r, 500));
        toast.success("Modifications enregistrées (démo)");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: values.display_name || null,
          first_name: values.first_name || null,
          last_name: values.last_name || null,
          phone: phoneText || null,
          notion_email: resolvedNotionEmail,
        })
        .eq("id", profile.id);
      if (profileError) throw profileError;

      if (values.email && values.email !== accountEmail) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: values.email,
        });
        if (emailError) throw emailError;
        toast.info(
          "Un email de confirmation a été envoyé à votre nouvelle adresse.",
        );
      }

      toast.success("Modifications enregistrées");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors de l'enregistrement";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      title="Informations du profil"
      description="Ces informations sont visibles dans l'application et utilisées pour votre facturation."
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <TextField
          id="display_name"
          label="Nom d'affichage"
          value={values.display_name}
          onChange={(v) => update("display_name", v)}
          autoComplete="nickname"
        />
        <div
          style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}
        >
          <TextField
            id="first_name"
            label="Prénom"
            value={values.first_name}
            onChange={(v) => update("first_name", v)}
            autoComplete="given-name"
          />
          <TextField
            id="last_name"
            label="Nom de famille"
            value={values.last_name}
            onChange={(v) => update("last_name", v)}
            autoComplete="family-name"
          />
        </div>

        <PhoneField
          id="phone"
          label="Numéro de téléphone"
          value={values.phone}
          onChange={(next) => update("phone", next)}
        />

        <EmailField
          platformEmail={values.email}
          notionEmail={values.notion_email}
          useSeparateNotionEmail={values.use_separate_notion_email}
          onPlatformEmailChange={(v) => update("email", v)}
          onNotionEmailChange={(v) => update("notion_email", v)}
          onToggleSeparateNotion={(enabled) =>
            setValues((prev) => ({
              ...prev,
              use_separate_notion_email: enabled,
              notion_email: enabled
                ? prev.notion_email || initialValues.notion_email
                : "",
            }))
          }
        />

        {hasChanges && (
          <div
            className="nc-mode-in"
            style={{ display: "flex", justifyContent: "flex-end" }}
          >
            <button
              type="submit"
              disabled={saving}
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

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  helper?: string;
  placeholder?: string;
};

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  helper,
  placeholder,
}: TextFieldProps) {
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
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="nc-input"
      />
      {helper && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-muted)",
            lineHeight: 1.4,
          }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}
