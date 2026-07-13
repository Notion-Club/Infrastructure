"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Bell, LoaderCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import {
  At,
  Bell as BellIcon,
  IphoneRadiowaves,
} from "@/shared/components/icons";

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
import { SettingsCard } from "./SettingsCard";
import type { UserOffer } from "./types";

// OPS-53 v2 — Une SEULE matrix intégrée, plus de section "Canaux" séparée.
// Le header de chaque colonne canal est un BOUTON cliquable (icône + label
// empilés verticalement) avec fond brand red quand le canal est activé.
// Click sur le header = toggle ON/OFF de toute la colonne, équivalent à
// l'ancien switcher de canal.
//
// Layout grid `minmax(0,1fr) repeat(3, 56px)` → tout tient inline sur
// mobile, plus de scroll horizontal. Les labels de type wrappent sur
// 2 lignes au besoin sur les viewports étroits, ce qui reste lisible.

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

type ChannelMeta = {
  key: NotificationChannel;
  label: string;
  Icon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
    "aria-hidden"?: boolean;
  }>;
  // Override de taille : certains glyphes (ex. iphone.radiowaves) sont larges
  // mais courts → rendus plus petits à taille égale. On les agrandit pour une
  // présence homogène avec les autres canaux.
  iconSize?: number;
};

const CHANNELS: ChannelMeta[] = [
  { key: "email", label: "Mail", Icon: At },
  { key: "in_app", label: "InApp", Icon: Bell },
  { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  // Web Push (mobile + desktop), requiert souscription navigateur. Sur iOS,
  // marche uniquement quand la PWA est installée sur l'écran d'accueil.
  { key: "push", label: "Push", Icon: IphoneRadiowaves, iconSize: 22 },
];

// Fusion visuelle In-App + Push : on n'affiche qu'UN seul canal, celui de la
// notification push (colonne « Push »). Les notifications in-app, elles,
// restent toujours activées par défaut → on masque la colonne In-App mais le
// schéma Supabase continue d'écrire les lignes `in_app` (forcées à true, cf.
// withInAppAlwaysOn + handleSave). Le canal push reste pilotable normalement.
const VISIBLE_CHANNELS: ChannelMeta[] = CHANNELS.filter(
  (c) => c.key !== "in_app",
);

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

// Normalise un jeu de préférences pour que le canal in-app soit toujours
// activé (objectif produit : les notifications in-app restent toujours ON).
// Appliqué au chargement initial ; le forçage est aussi répété à
// l'enregistrement pour les lignes envoyées à Supabase.
function withInAppAlwaysOn(s: NotificationSettings): NotificationSettings {
  const preferences = Object.fromEntries(
    Object.entries(s.preferences).map(([cat, chans]) => [
      cat,
      { ...chans, in_app: true },
    ]),
  ) as PreferenceMap;
  return { preferences, channels: { ...s.channels, in_app: true } };
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
  const initial = withInAppAlwaysOn(initialSettings ?? buildDefaults());
  const [channels, setChannels] = useState<ChannelMap>(initial.channels);
  const [prefs, setPrefs] = useState<PreferenceMap>(initial.preferences);
  const [saving, setSaving] = useState(false);

  // Push : la souscription navigateur (PushManager) doit être créée /
  // détruite *au moment du clic* sur le toggle Push (iOS Safari refuse
  // `pushManager.subscribe()` hors user gesture). On sync ensuite l'état
  // visuel du toggle avec le statut réel renvoyé par le hook.
  // `await Promise.resolve()` pour respecter la règle ESLint
  // `react-hooks/set-state-in-effect` du repo (cf. AGENTS.md).
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

  async function toggleChannel(channel: NotificationChannel) {
    // Cas spécial push : on ne peut pas se contenter de flipper le state.
    // Il faut demander la permission navigateur et créer/détruire la
    // souscription Web Push. Le state suit ensuite via l'effect ci-dessus.
    if (channel === "push") {
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
          // La cause d'un échec push est CÔTÉ CLIENT (subscribe() qui throw,
          // clé VAPID manquante, POST non-2xx…) → invisible dans les logs
          // serveur. On la loggue en console pour pouvoir diagnostiquer.
          console.error("[push] échec d'activation:", result.reason);
          toast.error("Impossible de mettre à jour la souscription push.");
        }
      } else if (turningOn) {
        toast.success("Notifications push activées 🎉");
      } else {
        toast.success("Notifications push désactivées.");
      }
      return;
    }
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
        toast.success("Préférences enregistrées (démo)");
        return;
      }

      // in_app forcé à true : la colonne est fusionnée dans Push côté UI, mais
      // on continue d'écrire les lignes in_app sur Supabase (toujours activées).
      const preferences = visibleCategories.flatMap((cat) =>
        NOTIFICATION_CHANNELS.map((ch) => ({
          category: cat.key,
          channel: ch,
          enabled: ch === "in_app" ? true : prefs[cat.key][ch],
        })),
      );
      const channelRows = NOTIFICATION_CHANNELS.map((ch) => ({
        channel: ch,
        enabled: ch === "in_app" ? true : channels[ch],
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
      iconNode={<BellIcon size={20} />}
      description="Définis les notifications que tu souhaites recevoir"
      fbLabel="Section notifications · Réglages"
    >
      <NotificationsMatrix
        categories={visibleCategories}
        channels={channels}
        prefs={prefs}
        onToggleChannel={toggleChannel}
        onTogglePref={togglePref}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          data-fb-label="Bouton Enregistrer préférences · Section notifications"
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
            transition: "opacity var(--nc-duration-xfast) var(--nc-ease)",
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
// NotificationsMatrix — table intégrée unique.
//
// Layout grid : `minmax(0, 1fr) repeat(3, 56px)` → la 1re colonne (Type)
// prend la place restante en s'adaptant, les 3 colonnes canaux sont fixes
// à 56 px. Avec ~ 320 px de contenu disponible dans une SettingsCard
// mobile, ça donne 152 px pour les labels de type → les longs labels
// wrappent sur 2 lignes proprement au lieu d'un scroll horizontal.
//
// Header :
//   - Cellule (0,0) : petit label "Type" en uppercase muted.
//   - Cellules (0,1..3) : ChannelHeaderButton (icône + label empilés
//     verticalement). Click = toggle on/off de toute la colonne. Fond
//     brand red + ombre quand actif, transparent + muted quand off.
//
// Body :
//   - Cellule (i,0) : label du type, lineHeight 1.3 pour rester lisible
//     même en cas de wrap sur 2 lignes.
//   - Cellules (i,1..3) : mini SwitchToggle (size sm). Quand la colonne
//     est OFF, opacity 0.4 + disabled.
// ============================================================================
function NotificationsMatrix({
  categories,
  channels,
  prefs,
  onToggleChannel,
  onTogglePref,
}: {
  categories: Category[];
  channels: ChannelMap;
  prefs: PreferenceMap;
  onToggleChannel: (ch: NotificationChannel) => void;
  onTogglePref: (cat: NotificationCategory, ch: NotificationChannel) => void;
}) {
  // Grid responsive via la classe `nc-notif-grid` (définie dans
  // globals.css). Sur mobile : `minmax(0,1fr) repeat(3, 56px)` (compact,
  // tient ≥ 320 px). Sur desktop : `minmax(0,1fr) repeat(3, 96px)` +
  // gap plus large → les 3 boutons canaux sont plus respirants et la
  // proportion titre/buttons devient correcte (sans grand vide central).
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
      {/* HEADER */}
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
        {VISIBLE_CHANNELS.map(({ key, label, Icon, iconSize }) => {
          // En-tête « actif » (rouge) UNIQUEMENT si le canal est ouvert ET qu'au
          // moins un type l'utilise. Avant, l'en-tête lisait seulement le flag
          // maître `channels[key]` : désactiver toute la colonne (décocher tous
          // les types) laissait la pilule rouge « comme si c'était encore activé ».
          // Maintenant, dès que la colonne est vide (ou le canal coupé), elle
          // repasse neutre — cohérent avec les toggles des cellules.
          const channelActive =
            channels[key] && categories.some((c) => prefs[c.key]?.[key]);
          return (
            <div key={key} role="columnheader">
              <ChannelHeaderButton
                label={label}
                Icon={Icon}
                iconSize={iconSize}
                active={channelActive}
                onClick={() => onToggleChannel(key)}
              />
            </div>
          );
        })}
      </div>

      {/* BODY */}
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
                : "1px solid var(--color-border-default)",
            alignItems: "center",
          }}
        >
          <div
            role="rowheader"
            style={{
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              lineHeight: 1.3,
              // Sur viewport étroit, les longs labels wrappent sur 2 lignes
              // au lieu d'overflow → reste lisible sans scroll horizontal.
              wordBreak: "normal",
              overflowWrap: "break-word",
            }}
          >
            {cat.label}
          </div>
          {VISIBLE_CHANNELS.map(({ key, label: chLabel }) => {
            const channelOff = !channels[key];
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
                  opacity: channelOff ? 0.4 : 1,
                  transition: "opacity var(--nc-duration-fast) var(--nc-ease)",
                }}
              >
                <SwitchToggle
                  size="sm"
                  checked={checked}
                  disabled={channelOff}
                  onChange={() => onTogglePref(cat.key, key)}
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
// ChannelHeaderButton — bouton cliquable dans le header de la matrix.
//   - Icône + label empilés verticalement (compact, tient en 56 px).
//   - Fond brand red + ombre douce quand actif → l'utilisateur voit
//     d'un coup d'œil quels canaux sont allumés.
//   - Click = toggle de toute la colonne.
//   - role="switch" pour qu'un lecteur d'écran annonce bien l'état.
// ============================================================================
function ChannelHeaderButton({
  label,
  Icon,
  iconSize = 16,
  active,
  onClick,
}: {
  label: string;
  Icon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
    "aria-hidden"?: boolean;
  }>;
  iconSize?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`Canal ${label}`}
      data-fb-label={`Interrupteur canal ${label} · Section notifications`}
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
        // Tint léger de la couleur brand quand actif (rgba 0.12) au lieu
        // d'un fond plein qui surcharge la matrix. Le texte et l'icône
        // restent en brand red sur ce fond clair → contraste lisible et
        // identité visuelle conservée sans dominer le composant.
        background: active ? "rgba(224, 98, 90, 0.12)" : "transparent",
        color: active ? "var(--color-brand)" : "var(--color-text-muted)",
        cursor: "pointer",
        transition:
          "background var(--nc-duration-fast) var(--nc-ease), color var(--nc-duration-fast) var(--nc-ease), border-color var(--nc-duration-fast) var(--nc-ease)",
        minHeight: 48,
        outline: "none",
        fontFamily: "inherit",
      }}
      className="hover:bg-[var(--nc-nav-hover-bg)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
    >
      <Icon size={iconSize} strokeWidth={active ? 2.25 : 2} aria-hidden />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ============================================================================
// SwitchToggle — iOS-like switch utilisé dans les cellules de la matrix.
// Taille `sm` par défaut, `md` dispo pour de futurs usages. Brand color
// quand activé, gris quand off, knob blanc avec transition left 200 ms.
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
  // Distance que le knob parcourt entre les états off/on. Le knob est
  // toujours positionné à `left: 2`, on l'anime ensuite via translateX
  // (GPU-composited → plus fluide qu'animer `left` qui déclenche le
  // layout à chaque frame, surtout visible sur mobile / WebKit).
  const knobTravel = w - knob - 4;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-fb-label={`Interrupteur ${ariaLabel} · Section notifications`}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      style={{
        width: w,
        height: h,
        borderRadius: 9999,
        background:
          checked && !disabled ? "var(--color-brand)" : "var(--nc-switch-off-bg)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background var(--nc-duration-fast) var(--nc-ease)",
        flexShrink: 0,
        padding: 0,
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
          // transform/translateX au lieu de `left` → GPU compositing,
          // animation fluide sur mobile (Safari iOS / Chrome Android
          // saccadaient avec `left` à cause des reflows).
          transform: `translateX(${checked ? knobTravel : 0}px)`,
          transition: "transform var(--nc-duration-fast) var(--nc-ease)",
          willChange: "transform",
        }}
      />
    </button>
  );
}
