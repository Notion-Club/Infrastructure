"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import {
  BIO_MAX_LENGTH,
  updateProfileAction,
  updateAccountEmailAction,
} from "@/modules/settings";
import { SettingsCard } from "./SettingsCard";
import { EmailField } from "./EmailField";
import { PhoneField, formatPhone, parsePhone, type PhoneValue } from "./PhoneField";
import type { ProfileRow } from "./types";

// OPS-47 — display_name n'est plus dans le form ; il vit dans le ProfileHero
// sous la photo (inline-edit). On le retire donc de FormValues, de la
// validation, de hasChanges et du payload submit.
type FormValues = {
  first_name: string;
  last_name: string;
  username: string;
  bio: string;
  phone: PhoneValue;
  email: string;
  notion_email: string;
  use_separate_notion_email: boolean;
};

type FieldErrors = Partial<
  Record<"username" | "bio" | "email" | "notion_email", string>
>;

function profileToForm(profile: ProfileRow, fallbackEmail: string): FormValues {
  const notionEmail = profile.notion_email ?? "";
  const platformEmail = fallbackEmail;
  return {
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    username: profile.username ?? "",
    bio: profile.bio ?? "",
    phone: parsePhone(profile.phone),
    email: platformEmail,
    notion_email: notionEmail,
    use_separate_notion_email:
      notionEmail.trim().length > 0 &&
      notionEmail.trim().toLowerCase() !== platformEmail.trim().toLowerCase(),
  };
}

// ============================================================================
// Validation client synchrone pour affichage inline (sous chaque champ)
// ============================================================================
// On valide les champs qui en ont vraiment besoin :
//   - username : 3-30 chars + regex
//   - bio : 500 chars max
//   - email (platform) : format valide
//   - notion_email (si toggle on) : format valide
// Pas de validation sur display_name / first_name / last_name : c'est trop
// personnel, l'user choisit ce qu'il veut (sauf max length, géré par maxlength
// côté input).
const USERNAME_REGEX = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BIO_LIMIT = 500;

function validateForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  // Username (obligatoire)
  const username = values.username.trim().toLowerCase();
  if (username.length === 0) {
    errors.username = "Le nom d'utilisateur est requis.";
  } else if (username.length < 3) {
    errors.username = "3 caractères minimum.";
  } else if (username.length > 30) {
    errors.username = "30 caractères maximum.";
  } else if (!USERNAME_REGEX.test(username)) {
    errors.username =
      "Lettres minuscules, chiffres, - et _ uniquement. Ne peut pas commencer ou finir par - ou _.";
  }

  // Bio
  if (values.bio.length > BIO_LIMIT) {
    errors.bio = `${BIO_LIMIT} caractères maximum.`;
  }

  // Email (auth platform)
  const email = values.email.trim();
  if (email.length === 0) {
    errors.email = "L'email est requis.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Format d'email invalide.";
  }

  // Notion email (uniquement si toggle on)
  if (values.use_separate_notion_email) {
    const notionEmail = values.notion_email.trim();
    if (notionEmail.length === 0) {
      errors.notion_email = "Email Notion requis.";
    } else if (!EMAIL_REGEX.test(notionEmail)) {
      errors.notion_email = "Format d'email invalide.";
    }
  }

  return errors;
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validation client : recalculée à chaque changement, mais affichée
  // uniquement pour les champs déjà "touched" (l'user a interagi avec).
  // Évite l'effet "tout est rouge dès l'ouverture de la page".
  const errors = useMemo(() => validateForm(values), [values]);
  const visibleErrors: FieldErrors = useMemo(() => {
    const v: FieldErrors = {};
    (Object.keys(errors) as (keyof FieldErrors)[]).forEach((k) => {
      if (touched[k]) v[k] = errors[k];
    });
    return v;
  }, [errors, touched]);
  const hasErrors = Object.keys(errors).length > 0;

  function markTouched(field: keyof FieldErrors) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  const hasChanges = useMemo(() => {
    if (values.first_name !== initialValues.first_name) return true;
    if (values.last_name !== initialValues.last_name) return true;
    if (values.username.trim().toLowerCase() !== initialValues.username) return true;
    if (values.bio !== initialValues.bio) return true;
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
    // Au submit, on marque tous les champs comme touched pour que les
    // erreurs apparaissent même si l'user n'a jamais focus le champ.
    if (hasErrors) {
      setTouched({
        username: true,
        bio: true,
        email: true,
        notion_email: true,
      });
      return;
    }
    setSaving(true);
    try {
      const phoneText = formatPhone(values.phone) || null;
      const resolvedNotionEmail = values.use_separate_notion_email
        ? values.notion_email.trim() || null
        : null;

      if (isMocked) {
        await new Promise((r) => setTimeout(r, 500));
        toast.success("Modifications enregistrées (démo)");
        return;
      }

      const emailChanged =
        values.email.trim().toLowerCase() !==
        accountEmail.trim().toLowerCase();

      const profileFieldsChanged =
        values.first_name !== initialValues.first_name ||
        values.last_name !== initialValues.last_name ||
        values.username.trim().toLowerCase() !== initialValues.username ||
        values.bio !== initialValues.bio ||
        values.phone.countryCode !== initialValues.phone.countryCode ||
        values.phone.national.trim() !== initialValues.phone.national.trim() ||
        values.use_separate_notion_email !==
          initialValues.use_separate_notion_email ||
        (values.use_separate_notion_email &&
          values.notion_email !== initialValues.notion_email);

      if (profileFieldsChanged) {
        const result = await updateProfileAction({
          first_name: values.first_name,
          last_name: values.last_name,
          username: values.username,
          bio: values.bio,
          phone: phoneText,
          notion_email: resolvedNotionEmail,
        });
        if (!result.ok) {
          // Si username pris, on flag le champ comme touched + on inject l'erreur
          // inline (en plus du toast). Sinon comportement standard.
          if (result.code === "username_taken") {
            setTouched((prev) => ({ ...prev, username: true }));
          }
          toast.error(result.message);
          return;
        }
      }

      if (emailChanged) {
        const result = await updateAccountEmailAction({
          newEmail: values.email,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.info(
          "Un email de confirmation a été envoyé à votre nouvelle adresse.",
        );
      }

      if (profileFieldsChanged || emailChanged) {
        toast.success("Modifications enregistrées");
      }
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
        <UsernameField
          value={values.username}
          onChange={(v) => update("username", v)}
          onBlur={() => markTouched("username")}
          error={visibleErrors.username}
        />

        {/* OPS-47 — le champ "Nom d'affichage" a été déplacé dans
            ProfileHero (inline-edit sous la photo). Il ne figure plus
            ici pour éviter le doublon mentionné dans le ticket. */}
        <div
          style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}
        >
          <TextField
            id="first_name"
            label="Prénom"
            value={values.first_name}
            onChange={(v) => update("first_name", v)}
            autoComplete="given-name"
            placeholder="Théo"
          />
          <TextField
            id="last_name"
            label="Nom de famille"
            value={values.last_name}
            onChange={(v) => update("last_name", v)}
            autoComplete="family-name"
            placeholder="GOUMAN"
          />
        </div>

        <BioField
          value={values.bio}
          onChange={(v) => update("bio", v)}
          onBlur={() => markTouched("bio")}
          error={visibleErrors.bio}
        />

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
          platformEmailError={visibleErrors.email}
          notionEmailError={visibleErrors.notion_email}
          onPlatformEmailChange={(v) => update("email", v)}
          onNotionEmailChange={(v) => update("notion_email", v)}
          onPlatformEmailBlur={() => markTouched("email")}
          onNotionEmailBlur={() => markTouched("notion_email")}
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

// OPS-47 — AnimatedDisplayNameField + DISPLAY_NAME_PLACEHOLDERS retirés.
// Le nom d'affichage vit désormais dans ProfileHero (inline-edit) plutôt que
// dans ce formulaire. Voir EditableDisplayName dans ProfileHero.tsx.

// ============================================================================
// UsernameField — input avec préfixe "@" et helper text dédié
// ============================================================================
function UsernameField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor="username"
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-secondary)",
        }}
      >
        Nom d&apos;utilisateur
      </label>
      <div style={{ position: "relative" }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: 14,
            transform: "translateY(-50%)",
            color: "var(--color-text-muted)",
            fontSize: 14,
            pointerEvents: "none",
            fontWeight: 500,
          }}
        >
          @
        </span>
        {/* OPS-56 — neutralise l'auto-fill du gestionnaire de mots de passe
            OS (Apple Passwords, 1Password, LastPass, Dashlane…). Sans ces
            attributs, Apple Passwords détectait le champ comme un email
            (à cause d'autoComplete="username") et proposait de remplir.
            Combo qui marche en pratique : autoComplete="off" + name non
            standard ("nc-handle") + data-1p-ignore + data-lpignore +
            data-form-type="other" (Dashlane). */}
        <input
          id="username"
          name="nc-handle"
          type="text"
          value={value}
          onChange={(e) => {
            // Lowercase + filtrage caractères pour éviter d'autoriser
            // de la saisie qui sera rejetée par zod côté serveur.
            const filtered = e.target.value
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, "");
            onChange(filtered);
          }}
          onBlur={onBlur}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={30}
          placeholder="ton-username"
          aria-invalid={error ? true : undefined}
          className="nc-input"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          style={{
            paddingLeft: 30,
            borderColor: error ? "var(--color-brand)" : undefined,
          }}
        />
      </div>
      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-brand)",
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-muted)",
            lineHeight: 1.4,
          }}
        >
          3-30 caractères, lettres minuscules, chiffres, <code>-</code> et{" "}
          <code>_</code>. Doit être unique.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// BioField — textarea avec compteur de caractères
// ============================================================================
function BioField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const length = value.length;
  const overLimit = length > BIO_MAX_LENGTH;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor="bio"
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-secondary)",
        }}
      >
        Bio
      </label>
      <textarea
        id="bio"
        name="bio"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={4}
        maxLength={BIO_MAX_LENGTH}
        placeholder="Parle un peu de toi…"
        aria-invalid={error ? true : undefined}
        className="nc-input"
        style={{
          resize: "vertical",
          minHeight: 90,
          paddingTop: 10,
          paddingBottom: 10,
          fontFamily: "inherit",
          lineHeight: 1.5,
          borderColor: error ? "var(--color-brand)" : undefined,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        {error ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--color-brand)",
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            {error}
          </p>
        ) : (
          <span />
        )}
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: overLimit
              ? "var(--color-brand)"
              : "var(--color-text-muted)",
            lineHeight: 1.4,
            textAlign: "right",
          }}
        >
          {length} / {BIO_MAX_LENGTH}
        </p>
      </div>
    </div>
  );
}
