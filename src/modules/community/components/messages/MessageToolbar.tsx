"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SmilePlus, Reply, MoreHorizontal, Copy, Pencil, Forward } from "lucide-react";
import { Trash } from "@/shared/components/icons";

// Picker complet — étendu (16 emojis) pour couvrir le besoin "j'ai pas mon
// emoji dans les 3 favoris". Aligné sur les emojis communs WhatsApp/Telegram.
const EMOJI_PICKER = [
  "👍", "❤️", "😂", "🙌", "🔥", "🎉", "💡", "😍",
  "👏", "🤯", "😢", "😡", "🤔", "🙏", "✨", "💯",
];

interface MessageToolbarProps {
  // Position de la toolbar relativement à la bulle : à gauche si le message
  // est de l'autre (on hover à droite), à droite si c'est mon message
  // (on hover à gauche). Pile la convention WhatsApp.
  align: "left" | "right";
  // Set des emojis sur lesquels le caller a déjà réagi pour ce message —
  // utilisé pour highlight l'état "on" dans le picker.
  reactedEmojis: Set<string>;
  // Callback réaction : appelée pour chaque emoji (toggle côté parent).
  onReact: (emoji: string) => void;
  // Quote-reply : ouvre le composer en mode "réponse à ce message". Déplacé
  // dans le menu ⋅⋅⋅ (plus de bouton dédié dans la barre).
  onReply: () => void;
  // Copie le contenu du message dans le presse-papier.
  onCopy: () => void;
  // Kebab : édition / partage / suppression. onDelete n'est fourni que pour
  // ses propres messages.
  onEdit?: () => void;
  onDelete?: () => void;
  onForward?: () => void;
  // Notifie le parent (MessageBubble) quand le picker OU le menu est ouvert,
  // pour qu'il maintienne la toolbar visible même quand le curseur sort de
  // la bulle (sinon le hover-leave fait disparaître le menu avant qu'on ait
  // pu cliquer une option).
  onOpenChange?: (open: boolean) => void;
}

export function MessageToolbar({
  align,
  reactedEmojis,
  onReact,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onForward,
  onOpenChange,
}: MessageToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Le menu et le picker sont rendus via createPortal (cf. plus bas) pour
  // sortir du stacking context de la bulle parente — sinon, malgré un
  // z-index élevé, ils passaient sous les bulles voisines (chaque bulle
  // crée son propre stacking context via position:relative). Voir le bug
  // visible sur prod où "Transférer" disparaissait sous le message suivant.
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Refs sur les boutons trigger pour positionner les popovers en absolu
  // depuis le viewport (via getBoundingClientRect dans le portal).
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Hydratation côté client (createPortal nécessite document, qui n'existe
  // pas au SSR).
  useEffect(() => {
    setMounted(true);
  }, []);

  // Click-outside global : ferme le picker / le menu si on clique hors.
  // Utilisé en complément du onMouseLeave parent — l'user peut vouloir
  // garder la toolbar ouverte en sortant brièvement de la bulle.
  useEffect(() => {
    if (!pickerOpen && !menuOpen) return;
    function close(e: MouseEvent) {
      const target = e.target as Node;
      if (
        pickerOpen &&
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        pickerBtnRef.current &&
        !pickerBtnRef.current.contains(target)
      ) {
        setPickerOpen(false);
      }
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pickerOpen, menuOpen]);

  // Calcule la position du popover dès qu'il s'ouvre, en se basant sur le
  // bounding rect du bouton trigger. Comme le popover est dans document.body
  // via createPortal, il faut le positionner en `position: fixed` par rapport
  // au viewport (pas par rapport au parent).
  useEffect(() => {
    if (!pickerOpen || !pickerBtnRef.current) return;
    const rect = pickerBtnRef.current.getBoundingClientRect();
    setPickerPos({
      // Bottom du popover = top du trigger - 6px (popover au-dessus, comme avant)
      top: rect.top - 6,
      left: rect.left,
      right: window.innerWidth - rect.right,
    });
  }, [pickerOpen]);

  useEffect(() => {
    if (!menuOpen || !menuBtnRef.current) return;
    const rect = menuBtnRef.current.getBoundingClientRect();
    setMenuPos({
      // Top du popover = bottom du trigger + 6px (popover en-dessous)
      top: rect.bottom + 6,
      left: rect.left,
      right: window.innerWidth - rect.right,
    });
  }, [menuOpen]);

  // Si la fenêtre est scrollée pendant que le popover est ouvert, on le
  // ferme — éviter qu'il "flotte" hors de son bouton trigger. Plus simple
  // qu'un reposition continu via scroll listener.
  useEffect(() => {
    if (!pickerOpen && !menuOpen) return;
    function onScrollOrResize() {
      setPickerOpen(false);
      setMenuOpen(false);
    }
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, { capture: true });
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [pickerOpen, menuOpen]);

  // Remonte au parent dès qu'un des deux popovers s'ouvre/ferme, pour qu'il
  // verrouille la toolbar visible et désactive les hovers des autres bulles.
  useEffect(() => {
    onOpenChange?.(pickerOpen || menuOpen);
  }, [pickerOpen, menuOpen, onOpenChange]);

  return (
    <div
      data-fb-label="Barre d'actions message · Bulle de message"
      className="nc-dropdown-elevated"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 9999,
        padding: "3px 5px",
        boxShadow: "var(--nc-shadow-3)",
        animation: "nc-mode-in 120ms var(--nc-ease) both",
      }}
    >
      {/* Deux icônes seulement : réaction (ouvre le picker) + menu ⋅⋅⋅. */}
      {/* Picker complet — bouton trigger seul, le popover est rendu via portal */}
      <button
        ref={pickerBtnRef}
        type="button"
        onClick={() => setPickerOpen((o) => !o)}
        data-fb-label="Bouton Plus d'emojis · Barre d'actions message"
        title="Plus d'emojis"
        style={{
          width: 28,
          height: 28,
          border: "none",
          background: pickerOpen ? "rgba(0,0,0,0.06)" : "transparent",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          transition: "background 120ms var(--nc-ease)",
        }}
        className="hover:bg-[rgba(0,0,0,0.05)]"
      >
        <SmilePlus size={14} />
      </button>
      {mounted && pickerOpen && pickerPos &&
        createPortal(
          <div
            ref={pickerRef}
            className="nc-dropdown-elevated"
            style={{
              position: "fixed",
              // Popover au-dessus du trigger : on positionne le BOTTOM du
              // popover sur le top du trigger. CSS-side : on utilise
              // `bottom: window.innerHeight - pickerPos.top` pour ancrer.
              bottom: window.innerHeight - pickerPos.top,
              [align === "right" ? "right" : "left"]:
                align === "right" ? pickerPos.right : pickerPos.left,
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              boxShadow: "var(--nc-shadow-3)",
              padding: 6,
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: 2,
              // z-index très élevé — on est dans document.body, donc plus
              // de conflit avec le stacking context d'une bulle voisine.
              zIndex: 9999,
              width: 264,
              animation: "nc-mode-in var(--nc-duration-xfast) var(--nc-ease) both",
            }}
          >
            {EMOJI_PICKER.map((e) => {
              const isActive = reactedEmojis.has(e);
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onReact(e);
                    setPickerOpen(false);
                  }}
                  title={isActive ? "Retirer la réaction" : "Réagir"}
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: 16,
                    border: "none",
                    background: isActive ? "rgba(224,98,90,0.12)" : "transparent",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  className="hover:bg-[rgba(0,0,0,0.06)]"
                >
                  {e}
                </button>
              );
            })}
          </div>,
          document.body,
        )}

      {/* Menu ⋅⋅⋅ — toujours présent (Répondre + Copier sont universels). Le
          menu est rendu via portal pour échapper au stacking context des
          bulles voisines (fix prod : "Transférer" passait sous la bulle
          suivante). */}
      <button
        ref={menuBtnRef}
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        data-fb-label="Menu Plus d'actions · Barre d'actions message"
        title="Plus d'actions"
        style={{
          width: 28,
          height: 28,
          border: "none",
          background: menuOpen ? "rgba(0,0,0,0.06)" : "transparent",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          transition: "background 120ms var(--nc-ease)",
        }}
        className="hover:bg-[rgba(0,0,0,0.05)]"
      >
        <MoreHorizontal size={14} />
      </button>
      {mounted && menuOpen && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="nc-dropdown-elevated"
            style={{
              position: "fixed",
              top: menuPos.top,
              [align === "right" ? "right" : "left"]:
                align === "right" ? menuPos.right : menuPos.left,
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              boxShadow: "var(--nc-shadow-3)",
              padding: 4,
              // z-index très élevé — on est dans document.body, donc on
              // passe au-dessus de toutes les bulles et stacking contexts
              // des messages voisins. C'est le fix robuste de OPS-95 / 105.
              zIndex: 9999,
              minWidth: 180,
              animation: "nc-mode-in var(--nc-duration-xfast) var(--nc-ease) both",
            }}
          >
            <MenuItem
              icon={<Reply size={14} />}
              label="Répondre"
              onClick={() => {
                setMenuOpen(false);
                onReply();
              }}
            />
            <MenuItem
              icon={<Copy size={14} />}
              label="Copier le message"
              onClick={() => {
                setMenuOpen(false);
                onCopy();
              }}
            />
            {onEdit && (
              <MenuItem
                icon={<Pencil size={14} />}
                label="Modifier"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              />
            )}
            {onForward && (
              <MenuItem
                icon={<Forward size={14} />}
                label="Transférer"
                onClick={() => {
                  setMenuOpen(false);
                  onForward();
                }}
              />
            )}
            {onDelete && (
              <MenuItem
                icon={<Trash size={14} />}
                label="Supprimer"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                danger
              />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Règle racine `.nc-menu-item` (hover fiable en CSS) — pas de
      // `background` inline qui écraserait le :hover. Cf. globals.css.
      className={`nc-menu-item${danger ? " nc-menu-item--danger" : ""}`}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
        color: danger ? "#e53e3e" : "var(--color-text-primary)",
        textAlign: "left",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
