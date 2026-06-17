"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Lock, Mail, MessageCircle, Smartphone } from "lucide-react";
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
import { usePushSubscription } from "@/shared/lib/hooks/usePushSubscription";
import { useDebouncedCallback } from "@/shared/lib/hooks/useDebouncedCallback";
import { SettingsCard } from "./SettingsCard";
import { SaveStatus, type SaveState } from "./SaveStatus";
import type { UserOffer } from "./types";

// Refonte notifications (premier jet) :
//   - In-app TOUJOURS actif, non désactivable → colonne « App » affichée mais
//     verrouillée (cases cochées, non cliquables).
//   - Push = un seul interrupteur global « Notifications push (PWA) » sous la
//     matrice (miroir de l'in-app), piloté par usePushSubscription. Plus de
//     colonne push dans la matrice.
//   - Seules colonnes configurables par catégorie : Mail et WhatsApp.
//   - Cliquer une case d'une colonne éteinte réactive ce canal (et ne coche
//     QUE cette case — pas de résurgence d'anciennes préférences).
//   - Auto-enregistrement (debounce 800 ms), plus de bouton « Enregistrer ».
//
// Côté données : rien ne change. On envoie toujours la matrice complète +
// les toggles globaux à updateNotificationSettingsAction. `in_app` est forcé
// à `true` partout ; `push` global reflète la souscription navigateur.

type Category = {
  key: NotificationCategory;
  label: string;
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

type MatrixChannel = {
  key: Extract<NotificationChannel, "email" | "in_app" | "whatsapp">;
  label: string;
  Icon: typeof Mail;
  // `locked` = canal toujours actif, non configurable (in-app).
  locked?: boolean;
};

// Colonnes de la matrice : Mail · App (verrouillée) · WhatsApp. Le push n'y
// figure plus — il a son interrupteur global dédié sous la matrice.
const MATRIX_CHANNELS: MatrixChannel[] = [
  { key: "email", label: "Mail", Icon: Mail },
  { key: "in_app", label: "App", Icon: Bell, locked: true },
  { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

// Fond clair (toujours) pour le knob OFF des switches, car les cellules vivent
// sur une ligne charbon dans les deux thèmes — un OFF translucide noir y serait
// invisible.
const ROW_SWITCH_OFF_BG = "rgba(255, 255, 255, 0.22)";

type PreferenceMap = NotificationSettings["preferences"];
type ChannelMap = NotificationSettings["channels"];

function buildDefaults(): NotificationSettings {
  const preferences = NOTIFICATION_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = { ...DEFAULT_CHANNEL_ENABLED, in_app: true };
    return acc;
  }, {} as PreferenceMap);
  return {
    preferences,
    channels: { ...DEFAULT_CHANNEL_ENABLED, in_app: true },
  };
}

// Normalise l'état initial : in-app forcé à true (canal toujours actif) au
// niveau global et pour chaque catégorie.
function normalizeInitial(initial: NotificationSettings): NotificationSettings {
  const preferences = NOTIFICATION_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = {
      ...DEFAULT_CHANNEL_ENABLED,
      ...(initial.preferences[cat] ?? {}),
      in_app: true,
    };
    return acc;
  }, {} as PreferenceMap);
  return {
    preferences,
    channels: { ...DEFAULT_CHANNEL_ENABLED, ...initial.channels, in_app: true },
  };
}

type NotificationsSectionProps = {
  userOffer: UserOffer;
  isMocked: boolean;
  initialSettings: NotificationSettings | null;
};

export function NotificationsSection({
  userOffer,
  isMocked,
  initialSettings,
}: NotificationsSectionProps) {
  const initial = initialSettings
    ? normalizeInitial(initialSettings)
    : buildDefaults();
  const [channels, setChannels] = useState<ChannelMap>(initial.channels);
  const [prefs, setPrefs] = useState<PreferenceMap>(initial.preferences);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Dernier état persisté avec succès — sert de point de revert si un
  // auto-save échoue.
  const savedSnapshot = useRef<NotificationSettings>(initial);

  // Push : la souscription navigateur (PushManager) doit être créée /
  // détruite *au moment du clic* (iOS Safari refuse `subscribe()` hors user
  // gesture). On synchronise l'état visuel du toggle avec le statut réel.
  const push = usePushSubscription();
  useEffect(() => {
    if (push.status === "loading") return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setChannels((prev) => {
        const next = push.status === "subscribed";
        if (prev.push === next) return prev;
        return { ...prev, push: next };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [push.status]);

  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter((cat) => {
        if (!cat.requiresOffer) return true;
        if (cat.requiresOffer === "coaching") return userOffer === "coaching";
        return true;
      }),
    [userOffer],
  );

  // ── Auto-enregistrement ───────────────────────────────────────────────────
  // doSave lit l'état frais via la closure (useDebouncedCallback rafraîchit sa
  // ref de callback à chaque render). On force in_app=true à l'écriture.
  function doSave() {
    if (isMocked) {
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    // Snapshot des maps d'état courantes (point de revert si l'écriture rate).
    const snapshot: NotificationSettings = {
      preferences: prefs,
      channels,
    };
    const preferencesPayload = visibleCategories.flatMap((cat) =>
      NOTIFICATION_CHANNELS.map((channel) => ({
        category: cat.key,
        channel,
        enabled: channel === "in_app" ? true : prefs[cat.key][channel],
      })),
    );
    const channelsPayload = NOTIFICATION_CHANNELS.map((channel) => ({
      channel,
      enabled: channel === "in_app" ? true : channels[channel],
    }));

    void (async () => {
      const result = await updateNotificationSettingsAction({
        preferences: preferencesPayload,
        channels: channelsPayload,
      });
      if (!result.ok) {
        // Revert vers le dernier état sauvegardé.
        setChannels(savedSnapshot.current.channels);
        setPrefs(savedSnapshot.current.preferences);
        setSaveState("error");
        toast.error(result.message);
        return;
      }
      savedSnapshot.current = snapshot;
      setSaveState("saved");
    })();
  }

  const scheduleSave = useDebouncedCallback(doSave, 800);

  // ── Mutations matrice ─────────────────────────────────────────────────────
  // Header d'une colonne configurable (Mail / WhatsApp) : ON/OFF de toute la
  // colonne (l'in-app verrouillé n'a pas de header cliquable).
  function toggleColumn(channel: NotificationChannel) {
    setChannels((prev) => ({ ...prev, [channel]: !prev[channel] }));
    scheduleSave();
  }

  // Clic sur une case (Mail / WhatsApp).
  //   - Colonne déjà active → simple toggle de la case.
  //   - Colonne éteinte → on réactive le canal ET on coche UNIQUEMENT cette
  //     case (les autres restent OFF : pas de résurgence d'anciennes prefs).
  function handleCellClick(
    category: NotificationCategory,
    channel: NotificationChannel,
  ) {
    if (channels[channel]) {
      setPrefs((prev) => ({
        ...prev,
        [category]: { ...prev[category], [channel]: !prev[category][channel] },
      }));
    } else {
      setChannels((prev) => ({ ...prev, [channel]: true }));
      setPrefs((prev) => {
        const next = { ...prev } as PreferenceMap;
        for (const cat of NOTIFICATION_CATEGORIES) {
          next[cat] = { ...next[cat], [channel]: cat === category };
        }
        return next;
      });
    }
    scheduleSave();
  }

  // ── Toggle push global (PWA) ──────────────────────────────────────────────
  async function handleTogglePush() {
    if (!push.support.supported) {
      const reasonLabel =
        push.support.reason === "no_vapid_key"
          ? "Notifications push non configurées côté serveur."
          : "Notifications push non supportées sur ce navigateur.";
      toast.error(reasonLabel);
      return;
    }
    const turningOn = !channels.push;
    const result = turningOn
      ? await push.subscribe()
      : await push.unsubscribe();
    if (!result.ok) {
      if (result.reason === "permission_denied") {
        toast.error(
          "Permission refusée. Active les notifications dans les réglages de ton navigateur.",
        );
      } else {
        toast.error("Impossible de mettre à jour la souscription push.");
      }
      return;
    }
    toast.success(
      turningOn ? "Notifications push activées 🎉" : "Notifications push désactivées.",
    );
    setChannels((prev) => ({ ...prev, push: turningOn }));
    scheduleSave();
  }

  const pushUnavailable = !push.support.supported || push.status === "denied";

  return (
    <SettingsCard
      title="Notifications"
      description="L'in-app est toujours actif. Choisissez les canaux Mail et WhatsApp par type de notification ; le push téléphone (PWA) s'active globalement plus bas."
      fbLabel="Section notifications · Réglages"
      action={<SaveStatus state={saveState} />}
    >
      <NotificationsMatrix
        categories={visibleCategories}
        channels={channels}
        prefs={prefs}
        onToggleColumn={toggleColumn}
        onCellClick={handleCellClick}
      />

      <PushToggle
        enabled={channels.push}
        unavailable={pushUnavailable}
        onToggle={handleTogglePush}
      />
    </SettingsCard>
  );
}

// ============================================================================
// NotificationsMatrix — table intégrée (en-tête + lignes catégorie).
// ============================================================================
function NotificationsMatrix({
  categories,
  channels,
  prefs,
  onToggleColumn,
  onCellClick,
}: {
  categories: Category[];
  channels: ChannelMap;
  prefs: PreferenceMap;
  onToggleColumn: (ch: NotificationChannel) => void;
  onCellClick: (cat: NotificationCategory, ch: NotificationChannel) => void;
}) {
  const baseGrid: React.CSSProperties = {
    display: "grid",
    padding: 6,
  };

  return (
    <div
      role="table"
      aria-label="Préférences de notification par type et canal"
      data-fb-label="Matrice notifications · Section notifications"
      style={{
        borderRadius: 14,
        border: "1px solid var(--color-border-default)",
        background: "var(--color-surface-card)",
        boxShadow: "var(--nc-shadow-3)",
        overflow: "hidden",
      }}
    >
      {/* HEADER (fond inchangé) */}
      <div
        role="row"
        className="nc-notif-grid"
        style={{
          ...baseGrid,
          background: "var(--color-surface-raised)",
          borderBottom: "1px solid var(--color-border-default)",
          alignItems: "stretch",
        }}
      >
        <div
          role="columnheader"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Type
        </div>
        {MATRIX_CHANNELS.map(({ key, label, Icon, locked }) => (
          <div key={key} role="columnheader">
            <ChannelHeaderButton
              label={label}
              Icon={Icon}
              active={locked ? true : channels[key]}
              locked={locked}
              onClick={locked ? undefined : () => onToggleColumn(key)}
            />
          </div>
        ))}
      </div>

      {/* BODY — lignes charbon contrastées (.nc-notif-row) */}
      {categories.map((cat, i) => (
        <div
          key={cat.key}
          role="row"
          className="nc-notif-grid nc-notif-row"
          style={{
            ...baseGrid,
            borderBottom:
              i === categories.length - 1
                ? "none"
                : "1px solid rgba(255,255,255,0.08)",
            alignItems: "center",
          }}
        >
          <div
            role="rowheader"
            style={{
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 500,
              // Hérite du clair de `.nc-notif-row` → lisible sur charbon.
              color: "inherit",
              lineHeight: 1.3,
              wordBreak: "normal",
              overflowWrap: "break-word",
            }}
          >
            {cat.label}
          </div>
          {MATRIX_CHANNELS.map(({ key, label: chLabel, locked }) => {
            if (locked) {
              // In-app : toujours coché, verrouillé, non cliquable.
              return (
                <div
                  key={key}
                  role="cell"
                  title="Toujours activé"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 8,
                  }}
                >
                  <SwitchToggle
                    size="sm"
                    checked
                    readOnly
                    ariaLabel={`${cat.label} via ${chLabel} (toujours activé)`}
                  />
                </div>
              );
            }
            const checked = prefs[cat.key][key] && channels[key];
            return (
              <div
                key={key}
                role="cell"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 8,
                }}
              >
                <SwitchToggle
                  size="sm"
                  checked={checked}
                  offBg={ROW_SWITCH_OFF_BG}
                  onChange={() => onCellClick(cat.key, key)}
                  ariaLabel={`${cat.label} via ${chLabel}`}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ChannelHeaderButton — en-tête de colonne canal.
//   - Mail / WhatsApp : bouton cliquable (toggle ON/OFF de la colonne).
//   - App (in-app) : statique + cadenas, signale « toujours actif ».
// ============================================================================
function ChannelHeaderButton({
  label,
  Icon,
  active,
  locked,
  onClick,
}: {
  label: string;
  Icon: typeof Mail;
  active: boolean;
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-disabled={locked || undefined}
      aria-label={locked ? `Canal ${label} (toujours activé)` : `Canal ${label}`}
      data-fb-label={
        locked
          ? `Canal ${label} verrouillé · Section notifications`
          : `Interrupteur canal ${label} · Section notifications`
      }
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "8px 4px",
        borderRadius: 10,
        border: active
          ? "1px solid rgba(224, 98, 90, 0.28)"
          : "1px solid transparent",
        background: active ? "rgba(224, 98, 90, 0.12)" : "transparent",
        color: active ? "var(--color-brand)" : "var(--color-text-muted)",
        cursor: locked ? "default" : "pointer",
        transition:
          "background 200ms var(--nc-ease), color 200ms ease, border-color 200ms ease",
        minHeight: 48,
        outline: "none",
        fontFamily: "inherit",
        position: "relative",
      }}
      className={
        locked
          ? undefined
          : "hover:bg-[var(--nc-nav-hover-bg)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
      }
    >
      <Icon size={16} strokeWidth={active ? 2.25 : 2} aria-hidden />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "-0.005em",
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        {label}
        {locked && <Lock size={9} aria-hidden />}
      </span>
    </button>
  );
}

// ============================================================================
// PushToggle — interrupteur global « Notifications push (PWA) » sous la matrice.
// ============================================================================
function PushToggle({
  enabled,
  unavailable,
  onToggle,
}: {
  enabled: boolean;
  unavailable: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      data-fb-label="Encadré notifications push PWA · Section notifications"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        border: "1px solid var(--color-border-default)",
        background: "var(--color-surface-card)",
        boxShadow: "var(--nc-shadow-3)",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: 10,
          flexShrink: 0,
          background: "rgba(224, 98, 90, 0.12)",
          color: "var(--color-brand)",
        }}
      >
        <Smartphone size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          Notifications push (PWA)
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 12,
            color: "var(--color-text-muted)",
            lineHeight: 1.4,
          }}
        >
          {unavailable
            ? "Indisponible sur ce navigateur. Sur iPhone, installe l'app sur l'écran d'accueil."
            : "Reçois sur ton téléphone les mêmes notifications que dans l'app."}
        </p>
      </div>
      <SwitchToggle
        checked={enabled}
        onChange={onToggle}
        ariaLabel="Notifications push (PWA)"
      />
    </div>
  );
}

// ============================================================================
// SwitchToggle — switch iOS-like.
//   - `readOnly` : affiché coché, non cliquable (cas in-app verrouillé).
//   - `offBg`    : couleur de fond OFF custom (cellules sur ligne charbon).
// ============================================================================
function SwitchToggle({
  checked,
  onChange,
  ariaLabel,
  disabled,
  readOnly,
  size = "md",
  offBg,
}: {
  checked: boolean;
  onChange?: () => void;
  ariaLabel: string;
  disabled?: boolean;
  readOnly?: boolean;
  size?: "md" | "sm";
  offBg?: string;
}) {
  const w = size === "sm" ? 32 : 42;
  const h = size === "sm" ? 20 : 24;
  const knob = size === "sm" ? 16 : 20;
  const knobTravel = w - knob - 4;
  const clickable = !disabled && !readOnly;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-disabled={!clickable || undefined}
      data-fb-label={`Interrupteur ${ariaLabel} · Section notifications`}
      onClick={clickable ? onChange : undefined}
      disabled={disabled}
      style={{
        width: w,
        height: h,
        borderRadius: 9999,
        background: checked
          ? "var(--color-brand)"
          : offBg ?? "var(--nc-switch-off-bg)",
        border: "none",
        cursor: clickable ? "pointer" : "default",
        position: "relative",
        transition: "background 200ms ease",
        flexShrink: 0,
        padding: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: knob,
          height: knob,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transform: `translateX(${checked ? knobTravel : 0}px)`,
          transition: "transform 200ms ease",
          willChange: "transform",
        }}
      />
    </button>
  );
}
