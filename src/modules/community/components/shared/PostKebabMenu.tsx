"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  // fermeture animée). Conservé pour compat — la carte hôte peut s'en servir,
  // mais le menu étant désormais rendu en portail (cf. plus bas) il n'est plus
  // clippé par l'encadré, donc l'élévation de z-index n'est plus indispensable.
  onOpenChange?: (open: boolean) => void;
  // Diamètre du bouton déclencheur (défaut 32). Passé à 36 dans l'overlay de
  // détail pour aligner le kebab sur la hauteur de la croix de fermeture.
  size?: number;
}

// Item de menu avec hover FIABLE via la règle racine `.nc-menu-item` (CSS) —
// pas de `background` inline qui écraserait le `:hover` (spécificité). Partagé
// avec le menu des messages privés. Cf. globals.css.
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
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`nc-menu-item${danger ? " nc-menu-item--danger" : ""}`}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        fontSize: 14,
        color: danger ? "#e0625a" : "var(--color-text-primary)",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function PostKebabMenu({ onCopyLink, onEdit, onDelete, onTogglePin, pinned, onOpenChange, size = 32 }: PostKebabMenuProps) {
  const { isOpen, isMounted, stateClass, close, toggle } = useDropdownTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Position calculée depuis le rect du bouton trigger (le menu est en
  // `position: fixed` dans document.body → coordonnées viewport). `pos` n'est
  // renseigné que côté client (dans l'effet ci-dessous) → le portail ne rend
  // rien au SSR, où `document` n'existe pas de toute façon.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // Le menu était auparavant rendu en `position: absolute` DANS la carte. Or
  // chaque carte du feed est enveloppée d'un `overflow: hidden` (wrapper de
  // collapse à la suppression, cf. FeedPostList) → le dropdown débordant sous la
  // carte était COUPÉ, quel que soit son z-index (un overflow:hidden ancêtre ne
  // se contourne pas au z-index). On le rend donc via createPortal dans
  // document.body, positionné en fixed sous le bouton → il échappe à tout
  // clip/stacking context. Même pattern que MessageToolbar (MP).
  useEffect(() => {
    if (!isMounted || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      // Aligné à droite sur le bord droit du bouton (menu qui s'ouvre vers la
      // gauche, comme l'ancien `right: 0` relatif au trigger).
      right: window.innerWidth - rect.right,
    });
  }, [isMounted]);

  // Click-outside : ferme si on clique hors du trigger ET hors du menu (le menu
  // vivant dans un portail, il n'est pas un descendant DOM du trigger).
  useEffect(() => {
    if (!isOpen) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [isOpen, close]);

  // Le feed défile : si l'utilisateur scrolle (ou redimensionne) menu ouvert, on
  // ferme plutôt que de laisser le popover « flotter » loin de son bouton.
  useEffect(() => {
    if (!isMounted) return;
    function onScrollOrResize() {
      close();
    }
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, { capture: true });
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isMounted, close]);

  // Signale la visibilité au parent sur `isMounted` (et non `isOpen`) pour
  // couvrir toute l'animation de fermeture.
  useEffect(() => {
    onOpenChange?.(isMounted);
  }, [isMounted, onOpenChange]);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={triggerRef}
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
          transition: "background var(--nc-duration-xfast) var(--nc-ease)",
        }}
        className="hover:bg-[rgba(0,0,0,0.06)]"
        aria-label="Options"
      >
        <MoreHorizontal size={16} />
      </button>

      {isMounted && pos &&
        createPortal(
          <div
            ref={menuRef}
            className={`t-dropdown nc-dropdown-elevated ${stateClass}`}
            data-origin="top-right"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: pos.top,
              right: pos.right,
              minWidth: 160,
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              boxShadow: "var(--nc-shadow-3)",
              padding: 4,
              // Dans document.body → au-dessus de l'overlay morph (4000) et de
              // toute carte, sans conflit de stacking context.
              zIndex: 9999,
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
          </div>,
          document.body,
        )}
    </div>
  );
}
