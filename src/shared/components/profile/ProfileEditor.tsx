"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";

import { BIO_MAX_LENGTH, updateProfileAction } from "@/modules/settings";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { useProfileIdentityContext } from "@/shared/components/identity/ProfileIdentityProvider";
import { ProfileHero } from "@/shared/components/settings/ProfileHero";
import type { ProfileRow } from "@/shared/components/settings/types";
import { MOCK_AUTH_USER, MOCK_PROFILE } from "@/shared/lib/settings/mock-data";

// ============================================================================
// ProfileEditor — surface d'édition du PROFIL PUBLIC (#128).
//
// Sépare clairement le « profil communauté » (photo, nom d'affichage,
// username, prénom/nom, bio) des « réglages compte » (email de connexion,
// téléphone) qui restent dans /settings.
//
// Le composant est monté uniquement quand la modale est ouverte (cf.
// ProfileModalProvider) : il charge donc ses données à l'ouverture, comme
// le faisait SettingsClient. Les changements sont propagés au contexte
// d'identité (updateIdentity) pour que la Topbar / Mobile se rafraîchissent
// sans reload.
// ============================================================================

const USERNAME_REGEX = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

type FieldErrors = Partial<Record<"username" | "bio", string>>;

function validate(username: string, bio: string): FieldErrors {
  const errors: FieldErrors = {};
  const u = username.trim().toLowerCase();
  if (u.length === 0) errors.username = "Le nom d'utilisateur est requis.";
  else if (u.length < 3) errors.username = "3 caractères minimum.";
  else if (u.length > 30) errors.username = "30 caractères maximum.";
  else if (!USERNAME_REGEX.test(u))
    errors.username =
      "Lettres minuscules, chiffres, - et _ uniquement. Ne peut pas commencer ou finir par - ou _.";
  if (bio.length > BIO_MAX_LENGTH)
    errors.bio = `${BIO_MAX_LENGTH} caractères maximum.`;
  return errors;
}

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      profile: ProfileRow;
      email: string;
      isMocked: boolean;
    };

export function ProfileEditor({ onClose }: { onClose: () => void }) {
  const { updateIdentity } = useProfileIdentityContext();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw error ?? new Error("no-user");
        const authUser = data.user;
        const { data: profileRow } = await supabase
          .from("profiles")
          .select(
            "id, avatar_url, avatar_color, display_name, first_name, last_name, username, bio, phone, communication_email, notion_email",
          )
          .eq("id", authUser.id)
          .maybeSingle<ProfileRow>();
        const profile: ProfileRow = profileRow ?? {
          id: authUser.id,
          avatar_url: null,
          avatar_color: null,
          display_name: null,
          first_name: null,
          last_name: null,
          username: null,
          bio: null,
          phone: null,
          communication_email: null,
          notion_email: null,
          // Champs facturation (OPS-129) — non édités ici, valeurs par défaut.
          billing_type: "individual",
          billing_company_id: null,
          billing_name: null,
          billing_address_line1: null,
          billing_address_line2: null,
          billing_postal_code: null,
          billing_city: null,
          billing_country: null,
        };
        if (!cancelled)
          setState({
            status: "ready",
            profile,
            email: authUser.email ?? "",
            isMocked: false,
          });
      } catch {
        if (!cancelled)
          setState({
            status: "ready",
            profile: MOCK_PROFILE,
            email: MOCK_AUTH_USER.email,
            isMocked: true,
          });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <EditorHeader onClose={onClose} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            padding: "8px 20px 40px",
          }}
          className="md:px-8"
        >
          {state.status === "loading" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 0",
                color: "var(--color-text-muted)",
              }}
            >
              <LoaderCircle size={20} className="animate-spin" />
            </div>
          ) : (
            <EditorBody
              profile={state.profile}
              email={state.email}
              isMocked={state.isMocked}
              onProfilePatch={(patch) =>
                setState((prev) =>
                  prev.status === "ready"
                    ? { ...prev, profile: { ...prev.profile, ...patch } }
                    : prev,
                )
              }
              updateIdentity={updateIdentity}
            />
          )}
        </div>
      </div>
    </>
  );
}

function EditorHeader({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "16px 16px 12px",
        borderBottom: "1px solid var(--color-border-default)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 700,
            color: "var(--color-text-primary)",
          }}
        >
          Mon profil
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--color-text-muted)",
            lineHeight: 1.4,
          }}
        >
          Visible par la communauté Notion Club.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        data-fb-label="Fermer · Éditeur de profil"
        style={{
          width: 36,
          height: 36,
          borderRadius: 9999,
          border: "1px solid var(--color-border-default)",
          background: "var(--color-surface-card)",
          color: "var(--color-text-secondary)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background 150ms ease, color 150ms ease",
        }}
        className="hover:bg-[var(--color-surface-raised)]"
      >
        <X size={17} />
      </button>
    </div>
  );
}

type EditorBodyProps = {
  profile: ProfileRow;
  email: string;
  isMocked: boolean;
  onProfilePatch: (patch: Partial<ProfileRow>) => void;
  updateIdentity: (patch: {
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    avatarColor?: string | null;
  }) => void;
};

function EditorBody({
  profile,
  email,
  isMocked,
  onProfilePatch,
  updateIdentity,
}: EditorBodyProps) {
  const [username, setUsername] = useState(profile.username ?? "");
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const errors = useMemo(() => validate(username, bio), [username, bio]);
  const hasErrors = Object.keys(errors).length > 0;
  const visibleErrors: FieldErrors = {
    ...(touched.username ? { username: errors.username } : {}),
    ...(touched.bio ? { bio: errors.bio } : {}),
  };

  const hasChanges =
    username.trim().toLowerCase() !== (profile.username ?? "").toLowerCase() ||
    firstName !== (profile.first_name ?? "") ||
    lastName !== (profile.last_name ?? "") ||
    bio !== (profile.bio ?? "");

  // Avatar : ProfileHero gère l'AvatarPicker + la sauvegarde serveur. Ici on
  // se contente de propager au state local + au contexte d'identité.
  function handleAvatarChange(next: {
    avatarUrl?: string | null;
    avatarColor?: string | null;
  }) {
    onProfilePatch({
      ...(next.avatarUrl !== undefined && { avatar_url: next.avatarUrl }),
      ...(next.avatarColor !== undefined && { avatar_color: next.avatarColor }),
    });
    updateIdentity({
      ...(next.avatarUrl !== undefined && { avatarUrl: next.avatarUrl }),
      ...(next.avatarColor !== undefined && { avatarColor: next.avatarColor }),
    });
  }

  // Nom d'affichage : inline-edit dans la pill du ProfileHero.
  async function handleDisplayNameSave(next: string) {
    const trimmed = next.trim() || null;
    onProfilePatch({ display_name: trimmed });
    updateIdentity({ displayName: trimmed });
    if (isMocked) {
      toast.success("Nom d'affichage mis à jour (démo)");
      return;
    }
    const result = await updateProfileAction({ display_name: trimmed });
    if (!result.ok) {
      toast.error(result.message);
      throw new Error(result.message);
    }
    toast.success("Nom d'affichage mis à jour");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasChanges || saving) return;
    if (hasErrors) {
      setTouched({ username: true, bio: true });
      return;
    }
    setSaving(true);
    try {
      if (isMocked) {
        toast.success("Profil mis à jour (démo)");
        onProfilePatch({
          username: username.trim().toLowerCase(),
          first_name: firstName || null,
          last_name: lastName || null,
          bio: bio || null,
        });
        return;
      }
      const result = await updateProfileAction({
        username,
        first_name: firstName,
        last_name: lastName,
        bio,
      });
      if (!result.ok) {
        if (result.code === "username_taken")
          setTouched((p) => ({ ...p, username: true }));
        toast.error(result.message);
        return;
      }
      onProfilePatch({
        username: username.trim().toLowerCase(),
        first_name: firstName || null,
        last_name: lastName || null,
        bio: bio || null,
      });
      updateIdentity({
        username: username.trim().toLowerCase() || null,
        firstName: firstName || null,
        lastName: lastName || null,
      });
      toast.success("Profil mis à jour");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      <ProfileHero
        avatarUrl={profile.avatar_url}
        avatarColor={profile.avatar_color}
        firstName={firstName || null}
        lastName={lastName || null}
        displayName={profile.display_name}
        email={email}
        isMocked={isMocked}
        onAvatarChange={handleAvatarChange}
        onDisplayNameSave={handleDisplayNameSave}
      />

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <TextField
          id="profile-first-name"
          label="Prénom"
          value={firstName}
          onChange={setFirstName}
          autoComplete="given-name"
          placeholder="Théo"
          fbLabel="Champ Prénom · Éditeur de profil"
        />
        <TextField
          id="profile-last-name"
          label="Nom de famille"
          value={lastName}
          onChange={setLastName}
          autoComplete="family-name"
          placeholder="GOUMAN"
          fbLabel="Champ Nom · Éditeur de profil"
        />
      </div>

      <UsernameField
        value={username}
        onChange={setUsername}
        onBlur={() => setTouched((p) => ({ ...p, username: true }))}
        error={visibleErrors.username}
      />

      <BioField
        value={bio}
        onChange={setBio}
        onBlur={() => setTouched((p) => ({ ...p, bio: true }))}
        error={visibleErrors.bio}
      />

      <div className="nc-profile-save-row">
        <button
          type="submit"
          disabled={!hasChanges || saving}
          data-fb-label="Bouton Enregistrer · Éditeur de profil"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 22px",
            borderRadius: 9999,
            border: "none",
            background: "var(--color-brand)",
            color: "white",
            fontWeight: 600,
            fontSize: 14,
            cursor: !hasChanges || saving ? "not-allowed" : "pointer",
            opacity: !hasChanges || saving ? 0.5 : 1,
            transition: "opacity 150ms ease",
            boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
          }}
        >
          {saving && <LoaderCircle size={14} className="animate-spin" />}
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// Field primitives — version locale alignée sur le design de ProfileSection.
// ============================================================================
function TextField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  fbLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  fbLabel?: string;
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
      <input
        id={id}
        name={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        data-fb-label={fbLabel}
        className="nc-input"
      />
    </div>
  );
}

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
        htmlFor="profile-username"
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
        <input
          id="profile-username"
          name="nc-handle"
          type="text"
          data-fb-label="Champ Nom d'utilisateur · Éditeur de profil"
          value={value}
          onChange={(e) =>
            onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
          }
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
          Identifiant public, unique. C&apos;est lui qui apparaît dans la
          communauté.
        </p>
      )}
    </div>
  );
}

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
        htmlFor="profile-bio"
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-secondary)",
        }}
      >
        Bio
      </label>
      <textarea
        id="profile-bio"
        name="bio"
        data-fb-label="Champ Bio · Éditeur de profil"
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
            color: overLimit ? "var(--color-brand)" : "var(--color-text-muted)",
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
