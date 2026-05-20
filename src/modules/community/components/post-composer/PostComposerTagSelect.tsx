"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { PostTag } from "../../types/post.types";

const ALL_TAGS: Array<{ value: PostTag; label: string; adminOnly?: boolean }> = [
  { value: "general", label: "Général" },
  { value: "question", label: "Question" },
  { value: "presentation", label: "Présentation" },
  { value: "annonce", label: "Annonce", adminOnly: true },
];

interface PostComposerTagSelectProps {
  value: PostTag;
  onChange: (tag: PostTag) => void;
  isAdmin: boolean;
}

export function PostComposerTagSelect({ value, onChange, isAdmin }: PostComposerTagSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tags = isAdmin ? ALL_TAGS : ALL_TAGS.filter((t) => !t.adminOnly);
  const selected = tags.find((t) => t.value === value)!;

  function handleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      const target = e.target as Node;
      const inButton = buttonRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inButton && !inDropdown) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          border: "1px solid var(--color-border-default)",
          borderRadius: 9999,
          background: "white",
          fontSize: 13,
          color: "var(--color-text-primary)",
          cursor: "pointer",
          fontWeight: 500,
          transition: "border-color 150ms ease",
        }}
      >
        {selected.label}
        <ChevronDown size={14} style={{ color: "var(--color-text-muted)" }} />
      </button>

      {open && dropdownPos && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            background: "white",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            boxShadow: "var(--nc-shadow-3)",
            padding: 4,
            zIndex: 10001,
            minWidth: 160,
            animation: "nc-mode-in 150ms var(--nc-ease) both",
          }}
        >
          {tags.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { onChange(t.value); setOpen(false); }}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: t.value === value ? "rgba(224,98,90,0.08)" : "transparent",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                color: t.value === value ? "var(--color-brand)" : "var(--color-text-primary)",
                fontWeight: t.value === value ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 100ms ease",
              }}
              className={t.value !== value ? "hover:bg-[#f5f5f5]" : ""}
            >
              {t.label}
              {t.adminOnly && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginLeft: 6 }}>
                  Admin
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
