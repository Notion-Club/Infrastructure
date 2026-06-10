"use client";

import { useRef, useEffect } from "react";
import { SmilePlus } from "lucide-react";
import { useDropdownTransition } from "@/shared/lib/hooks/useDropdownTransition";

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
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => toggle()}
        data-fb-label="Bouton Réagir · Communauté"
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
        className="hover:bg-[var(--nc-nav-hover-bg)] hover:border-[rgba(0,0,0,0.15)]"
      >
        <SmilePlus size={14} />
        {label}
      </button>

      {isMounted && (
        <div
          className={`t-dropdown ${stateClass}`}
          data-origin="bottom-left"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            background: "var(--color-surface-card)",
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
              onClick={() => { onSelect(emoji); close(); }}
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
              className="hover:bg-[var(--nc-nav-hover-bg)]"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
