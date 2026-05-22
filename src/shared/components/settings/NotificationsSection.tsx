"use client";

import { useMemo, useState } from "react";
import { Bell, LoaderCircle, Mail, MessageCircle } from "lucide-react";
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

// OPS-53 — Redesign de la section Notifications :
// 1. Canaux en row horizontale (3 "cards" Mail / InApp / WhatsApp avec
//    icône + label + iOS switcher), même langage visuel que le segmented
//    pill du community-page (feed / messages privés).
// 2. Types de notifications en table moderne : rows = catégories,
//    cols = canaux. Chaque cellule = mini switch. Si le canal est OFF
//    au-dessus, sa colonne est grisée + disabled.

type Category = {
  key: NotificationCategory;
  label: string;
  description?: string;
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

type ChannelMeta = {
  key: NotificationChannel;
  label: string;
  Icon: typeof Mail;
};

// Cf. brief OPS-53 : "Mail (icône mail), InApp (logo InApp), WhatsApp".
// Pas de SVG WhatsApp officiel dans lucide → MessageCircle (chat rond)
// est l'approximation la plus lisible.
const CHANNELS: ChannelMeta[] = [
  { key: "email", label: "Mail", Icon: Mail },
  { key: "in_app", label: "InApp", Icon: Bell },
  { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

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

  function togglePref(
    category: NotificationCategory,
    channel: NotificationChannel,
  ) {
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
      <ChannelsRow channels={channels} onToggle={toggleChannel} />

      <SettingsDivider />

      <TypesMatrix
        categories={visibleCategories}
        channels={channels}
        prefs={prefs}
        onToggle={togglePref}
      />

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

// ============================================================================
// ChannelsRow — rangée horizontale des 3 canaux (Mail / InApp / WhatsApp).
// Inspirée du segmented pill du community-page (feed / messages) : surface
// plate sur fond raised, cards blanches avec ombre douce quand le canal
// est actif. Chaque card = icône + label + iOS switch.
// ============================================================================
function ChannelsRow({
  channels,
  onToggle,
}: {
  channels: ChannelMap;
  onToggle: (ch: NotificationChannel) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
          margin: "0 0 8px",
          fontSize: 12,
          color: "var(--color-text-muted)",
        }}
      >
        Désactiver un canal coupera toutes les notifications de ce type.
      </p>

      <div
        role="group"
        aria-label="Canaux de notification"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
          padding: 4,
          background: "var(--color-surface-raised)",
          borderRadius: 14,
        }}
      >
        {CHANNELS.map(({ key, label, Icon }) => {
          const active = channels[key];
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: active ? "white" : "transparent",
                boxShadow: active
                  ? "0 1px 4px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.06)"
                  : "none",
                transition:
                  "background 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease)",
                minWidth: 0,
              }}
            >
              <Icon
                size={18}
                strokeWidth={2}
                aria-hidden
                style={{
                  color: active
                    ? "var(--color-brand)"
                    : "var(--color-text-muted)",
                  flexShrink: 0,
                  transition: "color 200ms ease",
                }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: active
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  transition: "color 200ms ease",
                }}
              >
                {label}
              </span>
              <SwitchToggle
                checked={active}
                onChange={() => onToggle(key)}
                ariaLabel={`Canal ${label}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// TypesMatrix — table moderne : rows = types de notifications, cols =
// canaux. Cellules = mini iOS switch. Header de col = icône du canal.
// Si le canal est OFF, sa colonne entière est désaturée + disabled.
// Overflow-x: auto pour la responsivité mobile.
// ============================================================================
function TypesMatrix({
  categories,
  channels,
  prefs,
  onToggle,
}: {
  categories: Category[];
  channels: ChannelMap;
  prefs: PreferenceMap;
  onToggle: (cat: NotificationCategory, ch: NotificationChannel) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 12,
          color: "var(--color-text-muted)",
        }}
      >
        Pour chaque type, choisissez par quel canal vous souhaitez le recevoir.
      </p>

      <div
        style={{
          // overflow-x pour permettre de scroller la table sur mobile sans
          // déformer son layout interne (les colonnes de canaux sont
          // alignées verticalement, on préfère scroller plutôt que wrapper).
          overflowX: "auto",
          borderRadius: 14,
          border: "1px solid var(--color-border-default)",
          background: "white",
          boxShadow: "var(--nc-shadow-3)",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 380,
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--color-surface-raised)",
                borderBottom: "1px solid var(--color-border-default)",
              }}
            >
              <th
                scope="col"
                style={{
                  ...CELL_BASE_STYLE,
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  width: "auto",
                }}
              >
                Type
              </th>
              {CHANNELS.map(({ key, label, Icon }) => {
                const active = channels[key];
                return (
                  <th
                    key={key}
                    scope="col"
                    style={{
                      ...CELL_BASE_STYLE,
                      width: 80,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        color: active
                          ? "var(--color-text-primary)"
                          : "var(--color-text-muted)",
                        opacity: active ? 1 : 0.55,
                        transition: "opacity 200ms ease, color 200ms ease",
                      }}
                    >
                      <Icon size={16} strokeWidth={2} aria-hidden />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {categories.map((cat, i) => (
              <tr
                key={cat.key}
                style={{
                  borderBottom:
                    i === categories.length - 1
                      ? "none"
                      : "1px solid var(--color-border-default)",
                }}
              >
                <th
                  scope="row"
                  style={{
                    ...CELL_BASE_STYLE,
                    textAlign: "left",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    width: "auto",
                  }}
                >
                  {cat.label}
                </th>
                {CHANNELS.map(({ key }) => {
                  const channelOff = !channels[key];
                  const checked = prefs[cat.key][key] && channels[key];
                  return (
                    <td
                      key={key}
                      style={{
                        ...CELL_BASE_STYLE,
                        textAlign: "center",
                        width: 80,
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: channelOff ? 0.4 : 1,
                          transition: "opacity 200ms ease",
                        }}
                      >
                        <SwitchToggle
                          size="sm"
                          checked={checked}
                          disabled={channelOff}
                          onChange={() => onToggle(cat.key, key)}
                          ariaLabel={`${cat.label} via ${key}`}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const CELL_BASE_STYLE: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
};

// ============================================================================
// SwitchToggle — iOS-like switch, brand-color quand activé. Deux tailles :
// `md` (défaut, ligne canaux) et `sm` (cellules de la matrice).
// ============================================================================
function SwitchToggle({
  checked,
  onChange,
  ariaLabel,
  disabled,
  size = "md",
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
  disabled?: boolean;
  size?: "md" | "sm";
}) {
  const w = size === "sm" ? 32 : 42;
  const h = size === "sm" ? 20 : 24;
  const knob = size === "sm" ? 16 : 20;
  const knobLeft = checked ? w - knob - 2 : 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      style={{
        width: w,
        height: h,
        borderRadius: 9999,
        background:
          checked && !disabled ? "var(--color-brand)" : "rgba(0,0,0,0.12)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background 200ms ease",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: knobLeft,
          width: knob,
          height: knob,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 200ms ease",
        }}
      />
    </button>
  );
}
