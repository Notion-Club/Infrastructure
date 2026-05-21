"use client";

import { useState } from "react";
import { Camera } from "lucide-react";

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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          {displayName?.trim() || email}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-muted)",
          }}
        >
          {email}
        </p>
      </div>

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
