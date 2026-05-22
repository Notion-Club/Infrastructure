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
        // OPS-62 v2 — pas de gap, on chevauche la pill via marginTop négatif.
        // Plus de bouton "Modifier l'avatar" secondaire en dessous : le badge
        // caméra sur l'avatar est désormais le seul CTA pour ouvrir le picker.
        gap: 0,
        padding: "8px 0 12px",
      }}
    >
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-label="Modifier ma photo de profil"
        // group permet au badge caméra de scaler au hover du bouton entier
        className="group"
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
        {/* OPS-62 v2 — Badge caméra promu en CTA principal pour modifier la
            photo, maintenant que le bouton secondaire en dessous est retiré.
            Évolutions vs version précédente :
              - taille 40×40 au lieu de 36×36 (touch-target confortable),
              - position légèrement décalée (right/bottom: -2) pour flotter
                hors du cercle et éviter le chevauchement avec la pill du
                nom d'affichage qui vient juste en dessous,
              - shadow brand-tinted (rgba 224,98,90) renforcée pour le
                mettre en valeur — c'est désormais le seul point d'entrée
                visible pour le picker depuis le hero,
              - hover scale 110% (via group-hover sur le bouton parent)
                pour le rendre clairement clickable. */}
        <span
          aria-hidden
          className="transition-transform duration-200 group-hover:scale-110"
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--color-brand)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid white",
            boxShadow:
              "0 10px 24px -8px rgba(224,98,90,0.55), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Camera size={16} strokeWidth={2.25} />
        </span>
      </button>

      <EditableDisplayName
        // key sur la valeur upstream → remount propre quand un autre onglet
        // / un revert optimistic modifie le profil. Évite un useEffect +
        // setState (cf. commentaire dans EditableDisplayName).
        key={displayName ?? ""}
        value={displayName ?? ""}
        onSave={onDisplayNameSave}
      />
      {/* Note OPS-47 : l'email n'est plus affiché ici. Il reste consultable
          dans l'encadré "Informations du profil" via le composant EmailField,
          qui est aussi le seul endroit où on peut le modifier.
          Note OPS-62 v2 : le bouton "Modifier l'avatar" secondaire a été
          retiré, le badge caméra ci-dessus est le seul CTA photo. */}

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
// EditableDisplayName — pill nom d'affichage chevauchant le bas de l'avatar
// (OPS-62 v2). État par défaut : bouton-pill blanc avec icône pencil au hover.
// Clic → input du même gabarit en focus immédiat ; Entrée / blur enregistre,
// Échap annule.
//
// Spécifications visuelles OPS-62 v2 :
//   - fond blanc, bord arrondi pill (radius 9999),
//   - bordure fine `var(--color-border-default)` + shadow `--nc-shadow-3`
//     pour rester cohérent avec le reste du design system,
//   - chevauche le bas de l'avatar via marginTop négatif,
//   - taille de police 13px (cohérente avec les boutons du design system —
//     ni trop gros, ni trop crammé),
//   - largeur min 220 / max 340 → la pill garde une taille stable et
//     les placeholders cyclants (jusqu'à 47 chars) tiennent en entier sans
//     ellipsis dans le cas standard,
//   - zIndex 2 pour passer au-dessus de l'avatar mais reste derrière le
//     badge caméra qui flotte hors du cercle (right/bottom: -2).
//
// Empty state : un cycle de 3 placeholders (PlaceholderCycle) tourne
// toutes les 3.4s avec fade in/out 260ms — invite l'utilisateur à
// remplir le champ. Cycle interrompu dès que la valeur upstream est non
// vide. Respecte prefers-reduced-motion.
//
// Note implémentation : `value` est passé comme `key` du composant par le
// parent → chaque changement upstream remount le composant et réinitialise
// proprement `draft`. Pas besoin de useEffect + setState (anti-pattern
// React 19 — cf. "you might not need an effect").
// ============================================================================
const PILL_FONT_SIZE = 13;
const PILL_OVERLAP = 16;
const PILL_MIN_WIDTH = 220;
const PILL_MAX_WIDTH = 340;

// 3 placeholders cyclants pour inviter à remplir le champ. Liste consolidée
// après OPS-46 (qui a retiré "Si tu devais te présenter en un mot ?").
const PLACEHOLDERS = [
  "Comment veux-tu qu'on t'appelle ?",
  "Ton prénom, ton pseudo… c'est toi qui choisis",
  "Le nom qui s'affichera partout dans l'app",
] as const;

function PlaceholderCycle() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Respect de prefers-reduced-motion — on fige sur le 1er message au
    // lieu de cycler (évite la fatigue visuelle pour les utilisateurs
    // sensibles aux animations).
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const cycle = setInterval(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setIndex((i) => (i + 1) % PLACEHOLDERS.length);
        setVisible(true);
      }, 260);
      return () => clearTimeout(swap);
    }, 3400);
    return () => clearInterval(cycle);
  }, []);

  return (
    <span
      style={{
        display: "inline-block",
        opacity: visible ? 1 : 0,
        transition: "opacity 260ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {PLACEHOLDERS[index]}
    </span>
  );
}

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

  // Wrapper commun aux deux états (display / edit). marginTop négatif
  // pour chevaucher l'avatar. zIndex 2 → au-dessus de l'avatar mais
  // toujours derrière le badge caméra qui flotte hors du cercle.
  const wrapperBase: React.CSSProperties = {
    position: "relative",
    marginTop: -PILL_OVERLAP,
    zIndex: 2,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: PILL_MIN_WIDTH,
    maxWidth: PILL_MAX_WIDTH,
  };

  if (editing) {
    return (
      <div style={wrapperBase}>
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
          placeholder={PLACEHOLDERS[0]}
          aria-label="Nom d'affichage"
          style={{
            width: "100%",
            fontSize: PILL_FONT_SIZE,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--color-text-primary)",
            background: "white",
            border: "1px solid var(--color-brand)",
            borderRadius: 9999,
            padding: "8px 18px",
            textAlign: "center",
            outline: "none",
            boxShadow:
              "0 0 0 3px rgba(224, 98, 90, 0.15), var(--nc-shadow-3)",
            fontFamily: "inherit",
          }}
        />
        {busy && (
          <LoaderCircle
            size={14}
            className="animate-spin"
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted)",
              pointerEvents: "none",
            }}
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
        ...wrapperBase,
        gap: 6,
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 9999,
        padding: "8px 16px 8px 18px",
        cursor: "pointer",
        color: isEmpty
          ? "var(--color-text-muted)"
          : "var(--color-text-primary)",
        fontSize: PILL_FONT_SIZE,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        fontStyle: isEmpty ? "italic" : "normal",
        outline: "none",
        // var(--nc-shadow-3) du design system — ombre fine cohérente
        // avec les autres cards/pills du dashboard.
        boxShadow: "var(--nc-shadow-3)",
        transition: "background 150ms ease, box-shadow 150ms ease",
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "center",
          whiteSpace: "nowrap",
          // textOverflow ellipsis uniquement en cas de débordement extrême
          // (nom > 50 chars). Les 3 placeholders cyclants tiennent en
          // entier dans la fourchette 220-340 ; les noms réels aussi
          // dans 99% des cas.
          textOverflow: "ellipsis",
          overflow: "hidden",
        }}
      >
        {isEmpty ? <PlaceholderCycle /> : display}
      </span>
      <Pencil
        size={13}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
      />
    </button>
  );
}
