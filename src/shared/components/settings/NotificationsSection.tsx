"use client";

import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { SettingsCard, SettingsDivider } from "./SettingsCard";
import type { UserOffer } from "./types";

type Channel = "email" | "in_app" | "sms";

type CategoryKey =
  | "new_modules"
  | "formation_reminders"
  | "coaching_calls"
  | "community_messages"
  | "billing";

type Category = {
  key: CategoryKey;
  label: string;
  description?: string;
  requiresOffer?: UserOffer;
};

const CATEGORIES: Category[] = [
  { key: "new_modules", label: "Nouveaux modules disponibles" },
  { key: "formation_reminders", label: "Rappels de formation" },
  {
    key: "coaching_calls",
    label: "Appels coaching disponibles",
    requiresOffer: "coaching",
  },
  { key: "community_messages", label: "Messages communauté" },
  { key: "billing", label: "Informations de facturation" },
];

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "in_app", label: "In-app" },
  { key: "sms", label: "SMS" },
];

type PreferenceMap = Record<CategoryKey, Record<Channel, boolean>>;

const DEFAULT_PREFERENCES: PreferenceMap = CATEGORIES.reduce((acc, cat) => {
  acc[cat.key] = {
    email: true,
    in_app: true,
    sms: false,
  };
  return acc;
}, {} as PreferenceMap);

type NotificationsSectionProps = {
  userId: string;
  userOffer: UserOffer;
  initialChannelDefaults?: Record<Channel, boolean>;
  initialPreferences?: PreferenceMap;
  isMocked: boolean;
};

export function NotificationsSection({
  userId,
  userOffer,
  initialChannelDefaults,
  initialPreferences,
  isMocked,
}: NotificationsSectionProps) {
  const [channels, setChannels] = useState<Record<Channel, boolean>>(
    initialChannelDefaults ?? { email: true, in_app: true, sms: false },
  );
  const [prefs, setPrefs] = useState<PreferenceMap>(
    initialPreferences ?? DEFAULT_PREFERENCES,
  );
  const [saving, setSaving] = useState(false);

  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter((cat) => {
        if (!cat.requiresOffer) return true;
        if (cat.requiresOffer === "coaching") return userOffer === "coaching";
        return true;
      }),
    [userOffer],
  );

  function toggleChannel(channel: Channel) {
    setChannels((prev) => ({ ...prev, [channel]: !prev[channel] }));
  }

  function togglePref(category: CategoryKey, channel: Channel) {
    setPrefs((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: !prev[category][channel],
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (isMocked) {
        await new Promise((r) => setTimeout(r, 500));
        toast.success("Préférences enregistrées (démo)");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const rows = visibleCategories.flatMap((cat) =>
        CHANNELS.map((ch) => ({
          user_id: userId,
          category: cat.key,
          channel: ch.key,
          enabled: prefs[cat.key][ch.key] && channels[ch.key],
        })),
      );
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(rows, { onConflict: "user_id,category,channel" });
      if (error) throw error;
      toast.success("Préférences enregistrées");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors de l'enregistrement des préférences";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      title="Notifications"
      description="Choisissez les canaux et les types de notifications que vous souhaitez recevoir."
    >
      {/* Channel toggles */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          Canaux
        </h3>
        <p
          style={{
            margin: "0 0 6px",
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          Désactiver un canal coupera toutes les notifications de ce type.
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {CHANNELS.map((ch, idx) => (
            <li
              key={ch.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom:
                  idx === CHANNELS.length - 1
                    ? "none"
                    : "1px solid var(--color-border-default)",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: "var(--color-text-primary)",
                }}
              >
                {ch.label}
              </span>
              <SwitchToggle
                checked={channels[ch.key]}
                onChange={() => toggleChannel(ch.key)}
                ariaLabel={`Canal ${ch.label}`}
              />
            </li>
          ))}
        </ul>
      </div>

      <SettingsDivider />

      {/* Categories matrix */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          Types de notifications
        </h3>
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "1fr",
            marginTop: 8,
          }}
        >
          {visibleCategories.map((cat) => (
            <div
              key={cat.key}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--color-border-default)",
                background: "white",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                }}
              >
                {cat.label}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                {CHANNELS.map((ch) => {
                  const disabled = !channels[ch.key];
                  return (
                    <label
                      key={ch.key}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        color: disabled
                          ? "var(--color-text-muted)"
                          : "var(--color-text-secondary)",
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={prefs[cat.key][ch.key] && channels[ch.key]}
                        onChange={() => togglePref(cat.key, ch.key)}
                        disabled={disabled}
                        style={{ accentColor: "var(--color-brand)" }}
                      />
                      {ch.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSave}
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
          {saving ? "Enregistrement…" : "Enregistrer les préférences"}
        </button>
      </div>
    </SettingsCard>
  );
}

function SwitchToggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      style={{
        width: 42,
        height: 24,
        borderRadius: 9999,
        background: checked ? "var(--color-brand)" : "rgba(0,0,0,0.12)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background 200ms ease",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 200ms ease",
        }}
      />
    </button>
  );
}
