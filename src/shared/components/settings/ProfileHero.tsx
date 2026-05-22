"use client";

import { useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";

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

// Constantes de mise en page partagées avec EditableDisplayName plus bas.
// On les définit ici pour qu'elles soient cohérentes entre l'avatar
// (badge caméra positionné en absolute) et la pill (largeur fixe +
// chevauchement contrôlé).
const AVATAR_SIZE = 124;
const BADGE_SIZE = 40;
// PILL_WIDTH = 360 → contient confortablement le plus long placeholder
// "Ton prénom, ton pseudo… c'est toi qui choisis" à 13px / 600 (≈ 295 px
// de glyphes), avec marge pour le padding gauche/droit.
const PILL_WIDTH = 360;
const PILL_HEIGHT = 40;
const PILL_OVERLAP = 6;
const PILL_FONT_SIZE = 13;

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

  function openPicker() {
    setPickerOpen(true);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Pas de gap : la pill chevauche via marginTop négatif (PILL_OVERLAP).
        gap: 0,
        padding: "8px 0 12px",
      }}
    >
      {/*
        Wrapper relatif autour de l'avatar. Le badge caméra est sorti du
        <button> avatar pour devenir un sibling positionné en absolute :
        c'est la seule manière de lui donner un z-index plus haut que la
        pill (z-index 2) — un span inside le button avatar serait coincé
        dans le stacking context du bouton, donc forcément en-dessous de
        la pill quoi qu'on fasse.

        Stacking final dans le contexte parent :
          - Avatar (z-index 1) … pill couvre son bas (chevauchement OK)
          - Pill (z-index 2)   … plate-forme blanche du nom
          - Badge (z-index 3)  … flotte par-dessus la pill au coin sup. droit
        Le wrapper lui-même n'a PAS de z-index → ne crée pas de stacking
        context, ses enfants participent au contexte parent et peuvent
        donc être comparés en z-index avec la pill, qui est sibling.
      */}
      <div
        style={{
          position: "relative",
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
        }}
      >
        <button
          type="button"
          onClick={openPicker}
          aria-label="Modifier ma photo de profil"
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: "none",
            padding: 0,
            cursor: "pointer",
            background: "transparent",
            zIndex: 1,
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
        </button>

        {/*
          Badge caméra — bouton à part entière (cliquable indépendamment
          du bouton avatar, même handler). Positionné en absolute dans le
          wrapper, légèrement décalé hors du cercle (right/bottom : -2)
          pour bien le démarquer.

          Z-index 3 : passe au-dessus de la pill (z-index 2) sur la zone
          de chevauchement. Comme la pill a un padding-top de PILL_HEIGHT/2
          environ (texte centré verticalement, line-height 1.2), le bord
          inférieur du badge (qui dépasse de quelques px dans le haut de
          la pill) tombe TOUJOURS dans le padding de la pill, jamais sur
          le texte.

          Hover : scale 110% pour signaler la cliquabilité.
        */}
        <button
          type="button"
          onClick={openPicker}
          aria-label="Modifier ma photo de profil"
          className="transition-transform duration-200 hover:scale-110 focus-visible:scale-110"
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: BADGE_SIZE,
            height: BADGE_SIZE,
            borderRadius: "50%",
            background: "var(--color-brand)",
            color: "white",
            border: "3px solid white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            boxShadow:
              "0 10px 24px -8px rgba(224,98,90,0.55), 0 2px 8px rgba(0,0,0,0.08)",
            zIndex: 3,
            outline: "none",
          }}
        >
          <Camera size={16} strokeWidth={2.25} />
        </button>
      </div>

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
          Note OPS-62 v3 : le bouton "Modifier l'avatar" secondaire est
          supprimé et le badge caméra ci-dessus est le seul CTA photo. */}

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
// PLACEHOLDERS — 3 messages cyclants. Liste consolidée après OPS-46.
// ============================================================================
const PLACEHOLDERS = [
  "Comment veux-tu qu'on t'appelle ?",
  "Ton prénom, ton pseudo… c'est toi qui choisis",
  "Le nom qui s'affichera partout dans l'app",
] as const;

// ============================================================================
// PlaceholderCycle — slot-machine vertical scroll inspiré du design
// Superdesign "Pur Animated Text Scroller" (draft c8746fb8). Une pile
// verticale de N+1 spans (les N messages + un duplicat du 1er pour
// rendre la boucle seamless) est translatée vers le haut via le
// keyframe `nc-placeholder-scroll` défini dans globals.css.
//
// Chaque item a une hauteur fixe `1em` (= height du container avec
// overflow:hidden) → un seul message est visible à la fois. La transition
// utilise l'easing cubic-bezier(0.76, 0, 0.24, 1) du design d'origine,
// qui donne ce "punch" satisfaisant en début et fin de chaque slide.
//
// La boucle est seamless : on duplique le 1er message en dernière
// position. Le keyframe va de translateY(0) à translateY(-75%) — donc
// après le 3e message on revoit le 1er à -75% — puis revient à 0%
// (1er aussi). Aucun saut visible.
//
// Respect de prefers-reduced-motion : la media query dans globals.css
// désactive l'animation et fige le 1er message visible.
//
// Pure CSS (pas de useEffect/setInterval) → animation fluide gérée par
// le compositor du navigateur, sans coût React à chaque frame.
// ============================================================================
function PlaceholderCycle() {
  // On stack [...messages, messages[0]] (4 items) pour que la boucle
  // soit seamless : translateY(-75%) affiche le duplicat du 1er msg,
  // identique au translateY(0%) du début → pas de "jump" visuel.
  const stack = [...PLACEHOLDERS, PLACEHOLDERS[0]];

  return (
    <span
      aria-label={PLACEHOLDERS[0]}
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        // 1.2em = hauteur de slot (cohérente avec le design Superdesign
        // d'origine `h-[1.2em]`). Donne assez d'air vertical pour éviter
        // que les descendants ('p', 'q') soient clippés par le overflow.
        height: "1.2em",
        overflow: "hidden",
        lineHeight: 1.2,
      }}
    >
      <span
        className="nc-placeholder-scroll"
        style={{
          display: "flex",
          flexDirection: "column",
          // willChange: "transform" → hint au compositor pour pousser le
          // calcul de l'animation sur la GPU.
          willChange: "transform",
        }}
      >
        {stack.map((text, i) => (
          <span
            key={i}
            aria-hidden={i !== 0}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "1.2em",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {text}
          </span>
        ))}
      </span>
    </span>
  );
}

// ============================================================================
// EditableDisplayName — pill de taille fixe (PILL_WIDTH × PILL_HEIGHT)
// qui chevauche le bas de l'avatar via marginTop négatif.
//
// Choix de design (OPS-62 v3) :
//   - Largeur FIXE (320 px) → le cycle de placeholders ne déclenche
//     plus aucun redimensionnement, transition parfaitement smooth.
//   - Pas de crayon visible : pas de "2e colonne" qui décale le texte ;
//     l'affordance d'édition est portée par le hover (background passe
//     à `--color-surface-raised`) + le curseur pointer.
//   - Padding-right légèrement plus grand que padding-left
//     (PILL_TEXT_PADDING_RIGHT vs PILL_TEXT_PADDING_LEFT) pour laisser
//     un "rest visuel" sous le badge caméra qui flotte par-dessus le
//     coin supérieur droit de la pill — le texte ne tombera jamais
//     sous le badge ni horizontalement ni verticalement.
//   - Police 13 px / weight 600 (cohérent avec les boutons du DS).
//   - z-index 2 → chevauche l'avatar (z-index 1) mais reste sous le
//     badge caméra (z-index 3).
//
// Sync de la valeur upstream : `key={value}` côté parent → remount au
// lieu d'un useEffect + setState (anti-pattern React 19).
// ============================================================================

// Padding asymétrique : un peu plus à droite pour ne pas que le texte
// passe trop près de la zone où le badge caméra dépasse par-dessus.
const PILL_TEXT_PADDING_LEFT = 22;
const PILL_TEXT_PADDING_RIGHT = 32;

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

  // Wrapper de TAILLE FIXE — c'est le levier principal qui fixe le
  // problème de saccade : la pill ne se redimensionne JAMAIS pendant
  // le cycle de placeholders, le crossfade reste smooth.
  const wrapperBase: React.CSSProperties = {
    position: "relative",
    marginTop: -PILL_OVERLAP,
    zIndex: 2,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
            height: "100%",
            fontSize: PILL_FONT_SIZE,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--color-text-primary)",
            background: "white",
            border: "1px solid var(--color-brand)",
            borderRadius: 9999,
            padding: `0 ${PILL_TEXT_PADDING_RIGHT}px 0 ${PILL_TEXT_PADDING_LEFT}px`,
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
      className="hover:bg-[var(--color-surface-raised)] focus-visible:bg-[var(--color-surface-raised)]"
      style={{
        ...wrapperBase,
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 9999,
        cursor: "pointer",
        color: isEmpty
          ? "var(--color-text-muted)"
          : "var(--color-text-primary)",
        fontSize: PILL_FONT_SIZE,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        fontStyle: isEmpty ? "italic" : "normal",
        outline: "none",
        // var(--nc-shadow-3) — ombre du design system pour rester cohérent
        // avec les autres cards/pills du dashboard.
        boxShadow: "var(--nc-shadow-3)",
        transition: "background 150ms ease, box-shadow 150ms ease",
        padding: `0 ${PILL_TEXT_PADDING_RIGHT}px 0 ${PILL_TEXT_PADDING_LEFT}px`,
      }}
    >
      {isEmpty ? (
        <PlaceholderCycle />
      ) : (
        <span
          style={{
            flex: 1,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}
        >
          {display}
        </span>
      )}
    </button>
  );
}
