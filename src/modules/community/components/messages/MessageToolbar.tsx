"use client";

import { useEffect, useRef, useState } from "react";
import { SmilePlus, Reply, MoreHorizontal, Pencil, Trash2, Forward } from "lucide-react";

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
  // Top 3 emojis quick-reaction du caller (alimentés par useUserTopEmojis).
  topEmojis: string[];
  // Set des emojis sur lesquels le caller a déjà réagi pour ce message —
  // utilisé pour highlight l'état "on" dans la toolbar.
  reactedEmojis: Set<string>;
  // Callback réaction : appelée pour chaque emoji (toggle côté parent).
  onReact: (emoji: string) => void;
  // Quote-reply : ouvre le composer en mode "réponse à ce message".
  onReply: () => void;
  // Kebab : actions destructives / partage. Si l'user n'est pas l'auteur,
  // seul onForward doit être fourni → kebab affiche uniquement "Transférer".
  onEdit?: () => void;
  onDelete?: () => void;
  onForward?: () => void;
}

export function MessageToolbar({
  align,
  topEmojis,
  reactedEmojis,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onForward,
}: MessageToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside global : ferme le picker / le menu si on clique hors.
  // Utilisé en complément du onMouseLeave parent — l'user peut vouloir
  // garder la toolbar ouverte en sortant brièvement de la bulle.
  useEffect(() => {
    if (!pickerOpen && !menuOpen) return;
    function close(e: MouseEvent) {
      if (pickerOpen && pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pickerOpen, menuOpen]);

  const hasKebab = !!onEdit || !!onDelete || !!onForward;

  return (
    <div
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
      {/* 3 quick emojis */}
      {topEmojis.map((emoji) => {
        const isActive = reactedEmojis.has(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            title={isActive ? "Retirer la réaction" : "Réagir"}
            style={{
              width: 28,
              height: 28,
              fontSize: 16,
              border: "none",
              background: isActive ? "rgba(224,98,90,0.10)" : "transparent",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 120ms ease, transform 120ms ease",
            }}
            className="hover:bg-[rgba(0,0,0,0.05)] hover:scale-110"
          >
            {emoji}
          </button>
        );
      })}

      {/* Picker complet — bouton + popup */}
      <div ref={pickerRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
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
            transition: "background 120ms ease",
          }}
          className="hover:bg-[rgba(0,0,0,0.05)]"
        >
          <SmilePlus size={14} />
        </button>
        {pickerOpen && (
          <div
            style={{
              position: "absolute",
              [align === "right" ? "right" : "left"]: 0,
              bottom: "calc(100% + 6px)",
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              boxShadow: "var(--nc-shadow-3)",
              padding: 6,
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: 2,
              zIndex: 200,
              width: 264,
            }}
          >
            {EMOJI_PICKER.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onReact(e);
                  setPickerOpen(false);
                }}
                style={{
                  width: 28,
                  height: 28,
                  fontSize: 16,
                  border: "none",
                  background: "transparent",
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
            ))}
          </div>
        )}
      </div>

      {/* Séparateur visuel */}
      <span
        style={{
          width: 1,
          height: 16,
          background: "var(--color-border-default)",
          margin: "0 2px",
        }}
      />

      {/* Reply */}
      <button
        type="button"
        onClick={onReply}
        title="Répondre"
        style={{
          width: 28,
          height: 28,
          border: "none",
          background: "transparent",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          transition: "background 120ms ease, color 120ms ease",
        }}
        className="hover:bg-[rgba(0,0,0,0.05)] hover:!text-[var(--color-text-primary)]"
      >
        <Reply size={14} />
      </button>

      {/* Kebab — Modifier / Supprimer (auteur) ou Transférer (tous) */}
      {hasKebab && (
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
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
              transition: "background 120ms ease",
            }}
            className="hover:bg-[rgba(0,0,0,0.05)]"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                [align === "right" ? "right" : "left"]: 0,
                top: "calc(100% + 6px)",
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 12,
                boxShadow: "var(--nc-shadow-3)",
                padding: 4,
                zIndex: 200,
                minWidth: 180,
                animation: "nc-mode-in 150ms var(--nc-ease) both",
              }}
            >
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
                  icon={<Trash2 size={14} />}
                  label="Supprimer"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  danger
                />
              )}
            </div>
          )}
        </div>
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
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        border: "none",
        background: "transparent",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
        color: danger ? "#e53e3e" : "var(--color-text-primary)",
        textAlign: "left",
      }}
      className={
        danger
          ? "hover:bg-[rgba(229,62,62,0.06)]"
          : "hover:bg-[rgba(0,0,0,0.05)]"
      }
    >
      {icon}
      {label}
    </button>
  );
}
