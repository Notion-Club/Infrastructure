"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  BIO_MAX_LENGTH,
  updateProfileAction,
  updateAccountEmailAction,
  type ProfileUpdateInput,
} from "@/modules/settings";
import { useDebouncedCallback } from "@/shared/lib/hooks/useDebouncedCallback";
import { SettingsCard } from "./SettingsCard";
import { SaveStatus, type SaveState } from "./SaveStatus";
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [emailSaving, setEmailSaving] = useState(false);
  const [serverUsernameError, setServerUsernameError] = useState<string | null>(
    null,
  );

  // Dernier état profil persisté avec succès — point de revert sur échec.
  const savedRef = useRef<FormValues>(initialValues);

  // Validation client : recalculée à chaque changement, mais affichée
  // uniquement pour les champs déjà "touched" (l'user a interagi avec).
  // Évite l'effet "tout est rouge dès l'ouverture de la page".
  const errors = useMemo(() => validateForm(values), [values]);
  const visibleErrors: FieldErrors = useMemo(() => {
    const v: FieldErrors = {};
    (Object.keys(errors) as (keyof FieldErrors)[]).forEach((k) => {
      if (touched[k]) v[k] = errors[k];
    });
    // L'erreur serveur « username déjà pris » s'affiche inline même sans touch.
    if (serverUsernameError) v.username = serverUsernameError;
    return v;
  }, [errors, touched, serverUsernameError]);

  function markTouched(field: keyof FieldErrors) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  // Revert des champs modifiés vers le dernier état sauvegardé (échec save).
  function revertChanged(saved: FormValues, changed: ProfileUpdateInput) {
    setValues((prev) => {
      const r = { ...prev };
      if ("first_name" in changed) r.first_name = saved.first_name;
      if ("last_name" in changed) r.last_name = saved.last_name;
      if ("username" in changed) r.username = saved.username;
      if ("bio" in changed) r.bio = saved.bio;
      if ("phone" in changed) r.phone = saved.phone;
      if ("notion_email" in changed) {
        r.notion_email = saved.notion_email;
        r.use_separate_notion_email = saved.use_separate_notion_email;
      }
      return r;
    });
  }

  // ── Auto-enregistrement des champs profil (hors email de login) ───────────
  // Email de login EXCLU : il déclenche un mail de confirmation Supabase → reste
  // une action explicite (bouton dédié dans EmailField). Mot de passe : géré
  // dans SecuritySection, jamais ici. Optimistic + revert (modèle patchDisplayName).
  function persistProfile() {
    const v = values;
    const saved = savedRef.current;

    // On ne sauve pas tant qu'un champ profil est invalide (format).
    const errs = validateForm(v);
    if (
      errs.username ||
      errs.bio ||
      (v.use_separate_notion_email && errs.notion_email)
    ) {
      return;
    }

    const changed: ProfileUpdateInput = {};
    if (v.first_name !== saved.first_name) changed.first_name = v.first_name;
    if (v.last_name !== saved.last_name) changed.last_name = v.last_name;
    if (
      v.username.trim().toLowerCase() !== saved.username.trim().toLowerCase()
    ) {
      changed.username = v.username;
    }
    if (v.bio !== saved.bio) changed.bio = v.bio;

    const phoneText = formatPhone(v.phone) || null;
    const savedPhoneText = formatPhone(saved.phone) || null;
    if (phoneText !== savedPhoneText) changed.phone = phoneText;

    const resolvedNotion = v.use_separate_notion_email
      ? v.notion_email.trim() || null
      : null;
    const savedNotion = saved.use_separate_notion_email
      ? saved.notion_email.trim() || null
      : null;
    if (resolvedNotion !== savedNotion) changed.notion_email = resolvedNotion;

    if (Object.keys(changed).length === 0) return;

    if (isMocked) {
      savedRef.current = v;
      setSaveState("saved");
      return;
    }

    setSaveState("saving");
    void (async () => {
      const result = await updateProfileAction(changed);
      if (!result.ok) {
        if (result.code === "username_taken") {
          // On garde la valeur saisie + erreur inline (l'user corrige).
          setServerUsernameError(
            "Ce nom d'utilisateur est déjà pris. Choisis-en un autre.",
          );
          setTouched((prev) => ({ ...prev, username: true }));
          setSaveState("error");
          return;
        }
        // Échec générique → revert des champs modifiés.
        revertChanged(saved, changed);
        setSaveState("error");
        toast.error(result.message);
        return;
      }
      savedRef.current = v;
      setServerUsernameError(null);
      setSaveState("saved");
    })();
  }

  const scheduleProfileSave = useDebouncedCallback(persistProfile, 1000);

  // Update d'un champ profil → maj optimiste + planifie l'auto-save.
  function updateProfileField<K extends keyof FormValues>(
    key: K,
    value: FormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === "username") setServerUsernameError(null);
    scheduleProfileSave();
  }

  // Email de login : update simple, pas d'auto-save (action explicite).
  function updateEmail(value: string) {
    setValues((prev) => ({ ...prev, email: value }));
  }

  const platformEmailChanged =
    values.email.trim().toLowerCase() !== accountEmail.trim().toLowerCase();
  const platformEmailValid = EMAIL_REGEX.test(values.email.trim());

  async function handleSavePlatformEmail() {
    if (!platformEmailChanged || !platformEmailValid || emailSaving) return;
    if (isMocked) {
      toast.info("Email de connexion (démo) — connectez-vous pour de vrai.");
      return;
    }
    setEmailSaving(true);
    try {
      const result = await updateAccountEmailAction({ newEmail: values.email });
      if (!result.ok) {
        setTouched((prev) => ({ ...prev, email: true }));
        toast.error(result.message);
        return;
      }
      toast.info(
        "Un email de confirmation a été envoyé à votre nouvelle adresse.",
      );
    } finally {
      setEmailSaving(false);
    }
  }

  return (
    <SettingsCard
      title="Informations du profil"
      description="Ces informations sont visibles dans l'application et utilisées pour votre facturation."
      fbLabel="Section profil · Réglages"
      action={<SaveStatus state={saveState} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <UsernameField
          value={values.username}
          onChange={(v) => updateProfileField("username", v)}
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
            onChange={(v) => updateProfileField("first_name", v)}
            autoComplete="given-name"
            placeholder="Théo"
            fbLabel="Champ Prénom · Section profil"
          />
          <TextField
            id="last_name"
            label="Nom de famille"
            value={values.last_name}
            onChange={(v) => updateProfileField("last_name", v)}
            autoComplete="family-name"
            placeholder="GOUMAN"
            fbLabel="Champ Nom · Section profil"
          />
        </div>

        <BioField
          value={values.bio}
          onChange={(v) => updateProfileField("bio", v)}
          onBlur={() => markTouched("bio")}
          error={visibleErrors.bio}
        />

        <PhoneField
          id="phone"
          label="Numéro de téléphone"
          value={values.phone}
          onChange={(next) => updateProfileField("phone", next)}
        />

        <EmailField
          platformEmail={values.email}
          notionEmail={values.notion_email}
          useSeparateNotionEmail={values.use_separate_notion_email}
          platformEmailError={visibleErrors.email}
          notionEmailError={visibleErrors.notion_email}
          platformEmailChanged={platformEmailChanged}
          platformEmailSaving={emailSaving}
          onPlatformEmailChange={updateEmail}
          onNotionEmailChange={(v) => updateProfileField("notion_email", v)}
          onPlatformEmailBlur={() => markTouched("email")}
          onNotionEmailBlur={() => markTouched("notion_email")}
          onPlatformEmailSave={handleSavePlatformEmail}
          onToggleSeparateNotion={(enabled) => {
            setValues((prev) => ({
              ...prev,
              use_separate_notion_email: enabled,
              notion_email: enabled
                ? prev.notion_email || initialValues.notion_email
                : "",
            }));
            scheduleProfileSave();
          }}
        />
      </div>
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
  fbLabel?: string;
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
  fbLabel,
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
        data-fb-label={fbLabel}
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

// OPS-46 / OPS-47 — AnimatedDisplayNameField + DISPLAY_NAME_PLACEHOLDERS
// retirés. Le nom d'affichage vit désormais dans ProfileHero (inline-edit
// dans la pill blanche chevauchant la photo) plutôt que dans ce
// formulaire. Voir EditableDisplayName dans ProfileHero.tsx.
// → OPS-46 (retrait du placeholder "Si tu devais te présenter en un
//   mot ?") est de facto livré par cette suppression : tout le cycle de
//   placeholders n'existe plus.

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
          data-fb-label="Champ Nom d'utilisateur · Section profil"
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
        data-fb-label="Champ Bio · Section profil"
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
