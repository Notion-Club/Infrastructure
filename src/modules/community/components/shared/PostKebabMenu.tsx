"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import { MoreHorizontal, Pencil, PinOff, Link as LinkIcon } from "lucide-react";
import { PinFill, Trash } from "@/shared/components/icons";
import { useDropdownTransition } from "@/shared/lib/hooks/useDropdownTransition";

interface PostKebabMenuProps {
  // Optionnel — si fourni, affiche "Copier le lien" en première position.
  // Toujours disponible (aucun droit requis), contrairement aux autres items.
  onCopyLink?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  // Optionnel — uniquement passé par les admins/mentors. Si fourni, affiche
  // un item "Épingler" / "Désépingler" en fonction du flag `pinned`.
  onTogglePin?: () => void;
  pinned?: boolean;
  // Notifie le parent quand le dropdown est visible (ouvert OU en cours de
  // fermeture animée). Permet à la carte hôte d'élever son z-index le temps que
  // le menu s'affiche, pour qu'il passe AU-DESSUS des cartes voisines (chaque
  // carte crée son propre contexte d'empilement via viewTransitionName).
  onOpenChange?: (open: boolean) => void;
  // Diamètre du bouton déclencheur (défaut 32). Passé à 36 dans l'overlay de
  // détail pour aligner le kebab sur la hauteur de la croix de fermeture.
  size?: number;
}

// Item de menu avec hover FIABLE : le fond hover est piloté en JS (state) et non
// par une classe Tailwind `hover:bg-*`. En effet, le `background` est posé en
// style INLINE sur le bouton → il l'emporte TOUJOURS sur une règle de feuille de
// style (spécificité), donc `hover:bg-[…]` restait sans effet visible. On rend
// donc le survol via onMouseEnter/onMouseLeave.
function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const hoverBg = danger
    ? "rgba(224,98,90,0.12)"
    : "var(--nc-nav-hover-bg)";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        fontSize: 14,
        color: danger ? "#e0625a" : "var(--color-text-primary)",
        background: hovered ? hoverBg : "transparent",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 150ms ease",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function PostKebabMenu({ onCopyLink, onEdit, onDelete, onTogglePin, pinned, onOpenChange, size = 32 }: PostKebabMenuProps) {
  const { isOpen, isMounted, stateClass, close, toggle } = useDropdownTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [isOpen, close]);

  // Signale la visibilité au parent sur `isMounted` (et non `isOpen`) pour que
  // la carte reste élevée pendant toute l'animation de fermeture du dropdown.
  useEffect(() => {
    onOpenChange?.(isMounted);
  }, [isMounted, onOpenChange]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        data-fb-label="Menu options · Communauté"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          transition: "background 150ms ease",
        }}
        className="hover:bg-[rgba(0,0,0,0.06)]"
        aria-label="Options"
      >
        <MoreHorizontal size={16} />
      </button>

      {isMounted && (
        <div
          className={`t-dropdown ${stateClass}`}
          data-origin="top-right"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 160,
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            boxShadow: "var(--nc-shadow-3)",
            padding: 4,
            zIndex: 100,
          }}
        >
          {onCopyLink && (
            <MenuItem
              icon={<LinkIcon size={14} />}
              label="Copier le lien"
              onClick={() => { onCopyLink(); close(); }}
            />
          )}
          {onEdit && (
            <MenuItem
              icon={<Pencil size={14} />}
              label="Modifier"
              onClick={() => { onEdit(); close(); }}
            />
          )}
          {onTogglePin && (
            <MenuItem
              icon={pinned ? <PinOff size={14} /> : <PinFill size={14} />}
              label={pinned ? "Désépingler" : "Épingler"}
              onClick={() => { onTogglePin(); close(); }}
            />
          )}
          {onDelete && (
            <MenuItem
              icon={<Trash size={14} />}
              label="Supprimer"
              danger
              onClick={() => { onDelete(); close(); }}
            />
          )}
        </div>
      )}
    </div>
  );
}
