"use client";

import { useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, PinOff } from "lucide-react";
import { PinFill, Trash } from "@/shared/components/icons";
import { useDropdownTransition } from "@/shared/lib/hooks/useDropdownTransition";

interface PostKebabMenuProps {
  onEdit?: () => void;
  onDelete?: () => void;
  // Optionnel — uniquement passé par les admins/mentors. Si fourni, affiche
  // un item "Épingler" / "Désépingler" en fonction du flag `pinned`.
  onTogglePin?: () => void;
  pinned?: boolean;
}

export function PostKebabMenu({ onEdit, onDelete, onTogglePin, pinned }: PostKebabMenuProps) {
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

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        data-fb-label="Menu options · Communauté"
        style={{
          width: 32,
          height: 32,
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
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); close(); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                fontSize: 14,
                color: "var(--color-text-primary)",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 150ms ease",
              }}
              className="hover:bg-[#f5f5f5] dark:hover:bg-[rgba(255,255,255,0.08)]"
            >
              <Pencil size={14} /> Modifier
            </button>
          )}
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTogglePin(); close(); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                fontSize: 14,
                color: "var(--color-text-primary)",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 150ms ease",
              }}
              className="hover:bg-[#f5f5f5] dark:hover:bg-[rgba(255,255,255,0.08)]"
            >
              {pinned ? <PinOff size={14} /> : <PinFill size={14} />}
              {pinned ? "Désépingler" : "Épingler"}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); close(); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                fontSize: 14,
                color: "#e0625a",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 150ms ease",
              }}
              className="hover:bg-[rgba(224,98,90,0.06)] dark:hover:bg-[rgba(224,98,90,0.14)]"
            >
              <Trash size={14} /> Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
