"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface PostKebabMenuProps {
  onEdit?: () => void;
  onDelete?: () => void;
}

export function PostKebabMenu({ onEdit, onDelete }: PostKebabMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
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

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 160,
            background: "white",
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
              onClick={(e) => { e.stopPropagation(); onEdit(); setOpen(false); }}
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
              className="hover:bg-[#f5f5f5]"
            >
              <Pencil size={14} /> Modifier
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); setOpen(false); }}
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
              className="hover:bg-[rgba(224,98,90,0.06)]"
            >
              <Trash2 size={14} /> Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
