"use client";

import { useState, useRef, useEffect } from "react";
import { SmilePlus } from "lucide-react";

const EMOJIS = ["❤️", "🔥", "🎉", "🙌", "💡", "😍", "👏", "🤯"];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  mode?: "post" | "comment"; // post = multi-select, comment = single
  selectedEmojis?: string[];
  label?: string;
}

export function ReactionPicker({
  onSelect,
  label = "+ Réagir",
}: ReactionPickerProps) {
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
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          borderRadius: 9999,
          border: "1px solid var(--color-border-default)",
          background: "transparent",
          fontSize: 13,
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          transition: "background 150ms ease, border-color 150ms ease",
        }}
        className="hover:bg-[rgba(0,0,0,0.04)] hover:border-[rgba(0,0,0,0.15)]"
      >
        <SmilePlus size={14} />
        {label}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            background: "white",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            boxShadow: "var(--nc-shadow-3)",
            padding: 8,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 4,
            zIndex: 100,
          }}
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onSelect(emoji); setOpen(false); }}
              style={{
                width: 36,
                height: 36,
                fontSize: 20,
                border: "none",
                background: "transparent",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 100ms ease",
              }}
              className="hover:bg-[rgba(0,0,0,0.06)]"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
