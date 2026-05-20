"use client";

import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import {
  DEFAULT_CHANNEL_ENABLED,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  updateNotificationSettingsAction,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationSettings,
} from "@/modules/settings";
import { SettingsCard, SettingsDivider } from "./SettingsCard";
import type { UserOffer } from "./types";

type Category = {
  key: NotificationCategory;
  label: string;
  requiresOffer?: UserOffer;
};

// L'ordre + les libellés UI vivent côté composant. Les valeurs autorisées
// (clés) viennent de @/modules/settings — source unique de vérité partagée
// avec le schema zod et les `check` côté DB.
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

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "Email",
  in_app: "In-app",
  whatsapp: "WhatsApp",
};

type PreferenceMap = NotificationSettings["preferences"];
type ChannelMap = NotificationSettings["channels"];

function buildDefaults(): NotificationSettings {
  const preferences = NOTIFICATION_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = { ...DEFAULT_CHANNEL_ENABLED };
    return acc;
  }, {} as PreferenceMap);
  return {
    preferences,
    channels: { ...DEFAULT_CHANNEL_ENABLED },
  };
}

type NotificationsSectionProps = {
  userOffer: UserOffer;
  isMocked: boolean;
  // null = mode démo / user non auth (le Server Component n'a pas pu fetch).
  // undefined ne devrait jamais arriver — typage défensif uniquement.
  initialSettings: NotificationSettings | null;
};

export function NotificationsSection({
  userOffer,
  isMocked,
  initialSettings,
}: NotificationsSectionProps) {
  const initial = initialSettings ?? buildDefaults();
  const [channels, setChannels] = useState<ChannelMap>(initial.channels);
  const [prefs, setPrefs] = useState<PreferenceMap>(initial.preferences);
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

  function toggleChannel(channel: NotificationChannel) {
    setChannels((prev) => ({ ...prev, [channel]: !prev[channel] }));
  }

  function togglePref(category: NotificationCategory, channel: NotificationChannel) {
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
        await new Promise((r) => setTimeout(r, 400));
        toast.success("Préférences enregistrées (démo)");
        return;
      }

      const preferences = visibleCategories.flatMap((cat) =>
        NOTIFICATION_CHANNELS.map((ch) => ({
          category: cat.key,
          channel: ch,
          enabled: prefs[cat.key][ch],
        })),
      );
      const channelRows = NOTIFICATION_CHANNELS.map((ch) => ({
        channel: ch,
        enabled: channels[ch],
      }));

      const result = await updateNotificationSettingsAction({
        preferences,
        channels: channelRows,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Préférences enregistrées");
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
          {NOTIFICATION_CHANNELS.map((ch, idx) => (
            <li
              key={ch}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom:
                  idx === NOTIFICATION_CHANNELS.length - 1
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
                {CHANNEL_LABELS[ch]}
              </span>
              <SwitchToggle
                checked={channels[ch]}
                onChange={() => toggleChannel(ch)}
                ariaLabel={`Canal ${CHANNEL_LABELS[ch]}`}
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
                {NOTIFICATION_CHANNELS.map((ch) => {
                  const channelOff = !channels[ch];
                  return (
                    <label
                      key={ch}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        color: channelOff
                          ? "var(--color-text-muted)"
                          : "var(--color-text-secondary)",
                        cursor: channelOff ? "not-allowed" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={prefs[cat.key][ch] && channels[ch]}
                        onChange={() => togglePref(cat.key, ch)}
                        disabled={channelOff}
                        style={{ accentColor: "var(--color-brand)" }}
                      />
                      {CHANNEL_LABELS[ch]}
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
