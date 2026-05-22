"use client";

import { useEffect, useState } from "react";
import { Camera, LoaderCircle, Pencil } from "lucide-react";

import { DEFAULT_AVATAR_COLOR } from "@/modules/settings";
import { AvatarPicker } from "./AvatarPicker";

// Cascade des initiales (cohérente avec computeInitials du hook
// useProfileIdentity utilisé dans la Topbar) :
//   1. first_name[0] + last_name[0]   → "JM" pour "Jean Moulin"
//   2. first_name[0..2]               → "JE" si juste un prénom "Jean"
//   3. displayName split par espaces  → fallback ancien comportement
//   4. email local part[0..2]         → fallback ultime
function getInitials(
  firstName: string | null,
  lastName: string | null,
  displayName: string | null,
  email: string,
): string {
  const fn = firstName?.trim();
  const ln = lastName?.trim();
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (ln) return ln.slice(0, 2).toUpperCase();
  const display = displayName?.trim();
  if (display) {
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "?";
}

type ProfileHeroProps = {
  avatarUrl: string | null;
  avatarColor: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string;
  isMocked: boolean;
  onAvatarChange: (next: {
    avatarUrl?: string | null;
    avatarColor?: string | null;
  }) => void;
  // Save handler for inline-edit of the display name under the photo.
  // Implementation: optimistic local update + server action + identity
  // context update so Topbar / Mobile reflect the change immediately.
  // Throws on failure so the inline-edit can show its error state.
  onDisplayNameSave: (next: string) => Promise<void>;
};

export function ProfileHero({
  avatarUrl,
  avatarColor,
  firstName,
  lastName,
  displayName,
  email,
  isMocked,
  onAvatarChange,
  onDisplayNameSave,
}: ProfileHeroProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const initials = getInitials(firstName, lastName, displayName, email);
  const bg = avatarColor ?? DEFAULT_AVATAR_COLOR;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "8px 0 12px",
      }}
    >
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-label="Personnaliser l'avatar"
        style={{
          position: "relative",
          width: 124,
          height: 124,
          borderRadius: "50%",
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: "transparent",
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, rgba(224,98,90,0.0), rgba(224,98,90,0.55) 35%, rgba(224,98,90,0.0) 65%)",
            filter: "blur(10px)",
            opacity: 0.7,
            pointerEvents: "none",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: avatarUrl ? "transparent" : bg,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: "0.02em",
            border: "4px solid white",
            boxShadow:
              "0 14px 32px -10px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.06)",
            overflow: "hidden",
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
            initials
          )}
        </span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: 4,
            bottom: 4,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--color-brand)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid white",
            boxShadow: "0 6px 16px -4px rgba(224,98,90,0.45)",
          }}
        >
          <Camera size={14} />
        </span>
      </button>

      <EditableDisplayName
        value={displayName ?? ""}
        onSave={onDisplayNameSave}
      />
      {/* Note OPS-47 : l'email n'est plus affiché ici. Il reste consultable
          dans l'encadré "Informations du profil" via le composant EmailField,
          qui est aussi le seul endroit où on peut le modifier. */}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        style={{
          padding: "6px 14px",
          borderRadius: 9999,
          border: "1px solid var(--color-border-default)",
          background: "white",
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "background 150ms ease",
        }}
        className="hover:bg-[var(--color-surface-raised)]"
      >
        <Camera size={12} />
        Modifier l&apos;avatar
      </button>

      {pickerOpen && (
        <AvatarPicker
          currentColor={avatarColor}
          currentAvatarUrl={avatarUrl}
          hasPhoto={!!avatarUrl}
          initials={initials}
          isMocked={isMocked}
          onClose={() => setPickerOpen(false)}
          onAvatarUpdated={onAvatarChange}
        />
      )}
    </div>
  );
}

// ============================================================================
// EditableDisplayName — affiche le nom d'affichage sous l'avatar (OPS-47).
// État par défaut : bouton qui mime un H1 + icône pencil au hover.
// Clic → input du même style en focus immédiat ; Entrée / blur enregistre,
// Échap annule. Optimistic update côté parent ; les erreurs réseau sont
// gérées par le parent via toast (on relève juste l'exception ici pour ne
// pas masquer l'erreur visuelle).
// ============================================================================
function EditableDisplayName({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  // Re-sync draft when the upstream value changes while not editing
  // (e.g. another tab updated the profile).
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  async function commit() {
    const trimmed = draft.trim();
    if (busy) return;
    if (trimmed === value.trim()) {
      setEditing(false);
      setDraft(value);
      return;
    }
    setBusy(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      // Le parent affiche déjà un toast d'erreur. On garde l'input ouvert
      // pour que l'utilisateur puisse réessayer.
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "2px 4px",
        }}
      >
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") cancel();
          }}
          disabled={busy}
          maxLength={60}
          placeholder="Comment veux-tu qu'on t'appelle ?"
          aria-label="Nom d'affichage"
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--color-text-primary)",
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-brand)",
            borderRadius: 10,
            padding: "4px 12px",
            textAlign: "center",
            minWidth: 240,
            maxWidth: 360,
            outline: "none",
            boxShadow: "0 0 0 3px rgba(224, 98, 90, 0.15)",
            fontFamily: "inherit",
          }}
        />
        {busy && (
          <LoaderCircle
            size={16}
            className="animate-spin"
            style={{ color: "var(--color-text-muted)" }}
          />
        )}
      </div>
    );
  }

  const display = value.trim();
  const isEmpty = display.length === 0;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={
        isEmpty ? "Ajouter un nom d'affichage" : "Modifier le nom d'affichage"
      }
      className="group hover:bg-[var(--color-surface-raised)] focus-visible:bg-[var(--color-surface-raised)]"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "4px 10px",
        borderRadius: 10,
        transition: "background 150ms ease",
        color: isEmpty
          ? "var(--color-text-muted)"
          : "var(--color-text-primary)",
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        fontStyle: isEmpty ? "italic" : "normal",
        outline: "none",
      }}
    >
      <span>{isEmpty ? "Choisis ton nom d'affichage" : display}</span>
      <Pencil
        size={14}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
      />
    </button>
  );
}
