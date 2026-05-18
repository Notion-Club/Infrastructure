"use client";

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { LoaderCircle, Pencil } from "lucide-react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { SettingsCard } from "./SettingsCard";
import type { ProfileRow } from "./types";

type FormValues = {
  display_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  notion_email: string;
};

function profileToForm(profile: ProfileRow): FormValues {
  return {
    display_name: profile.display_name ?? "",
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    phone: profile.phone ?? "",
    notion_email: profile.notion_email ?? "",
  };
}

const AVATARS_BUCKET = "avatars";

type ProfileSectionProps = {
  profile: ProfileRow;
  isMocked: boolean;
};

export function ProfileSection({ profile, isMocked }: ProfileSectionProps) {
  const initialValues = useMemo(() => profileToForm(profile), [profile]);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasChanges = useMemo(() => {
    return (Object.keys(values) as Array<keyof FormValues>).some(
      (key) => values[key] !== initialValues[key],
    );
  }, [values, initialValues]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isMocked) {
      // Preview locally — no real upload in demo.
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatarUrl(typeof ev.target?.result === "string" ? ev.target.result : null);
        toast.info("Aperçu local — connectez-vous pour enregistrer votre avatar.");
      };
      reader.readAsDataURL(file);
      return;
    }
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      if (updateError) throw updateError;
      setAvatarUrl(publicUrl);
      toast.success("Photo de profil mise à jour");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'envoi de la photo";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      if (isMocked) {
        await new Promise((r) => setTimeout(r, 500));
        toast.success("Modifications enregistrées (démo)");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: values.display_name || null,
          first_name: values.first_name || null,
          last_name: values.last_name || null,
          phone: values.phone || null,
          notion_email: values.notion_email || null,
        })
        .eq("id", profile.id);
      if (error) throw error;
      toast.success("Modifications enregistrées");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const initials = (values.display_name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <SettingsCard
      title="Informations du profil"
      description="Ces informations sont visibles dans l'application et utilisées pour votre facturation."
    >
      {/* Avatar uploader */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Modifier la photo de profil"
          disabled={uploading}
          style={{
            position: "relative",
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "none",
            cursor: uploading ? "wait" : "pointer",
            padding: 0,
            background: "var(--color-brand)",
            color: "white",
            fontSize: 20,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials || "?"
          )}
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "white",
              border: "1px solid var(--color-border-default)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            {uploading ? (
              <LoaderCircle size={12} className="animate-spin" />
            ) : (
              <Pencil size={11} />
            )}
          </span>
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
            Photo de profil
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}
          >
            JPG ou PNG, 2 Mo maximum
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleAvatarChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Form */}
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
        <TextField
          id="phone"
          label="Numéro de téléphone"
          value={values.phone}
          onChange={(v) => update("phone", v)}
          autoComplete="tel"
          type="tel"
        />
        <TextField
          id="notion_email"
          label="Email Notion"
          value={values.notion_email}
          onChange={(v) => update("notion_email", v)}
          autoComplete="email"
          type="email"
          helper="Utilisé pour vous inviter dans les espaces Notion. Peut être différent de votre email de connexion."
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={!hasChanges || saving}
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
              cursor: !hasChanges || saving ? "not-allowed" : "pointer",
              opacity: !hasChanges || saving ? 0.5 : 1,
              transition: "opacity 150ms ease, transform 150ms ease",
              boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
            }}
          >
            {saving && <LoaderCircle size={14} className="animate-spin" />}
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}

/* ------------------------- TextField ------------------------- */

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
