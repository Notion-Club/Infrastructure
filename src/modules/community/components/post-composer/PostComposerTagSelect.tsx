"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type { PostTag } from "../../types/post.types";

// OPS-52 — fix dropdown qui ne s'ouvrait pas. Cause racine : le dropdown
// était rendu dans le sous-arbre du PostComposerModal (lui-même rendu via
// createPortal vers <body>). Le modal a un overlay en `position: fixed +
// inset: 0` avec un click handler global qui ferme si `e.target ===
// e.currentTarget`. La combinaison fixed + modal overlay + stacking
// context interne du modal masquait visuellement le dropdown (selon
// l'arbre rendu, position fixed peut être affectée par des ancêtres
// transform / filter / backdrop-filter — la spec CSS dit qu'un ancêtre
// avec ces propriétés devient le containing block pour fixed).
//
// Fix : on porte la dropdown DIRECTEMENT dans `document.body` via un
// createPortal séparé. Plus de risque d'être contraint par un ancêtre
// transformé, plus de risque de stacking context lower que le modal.
// Le z-index 10010 reste au-dessus du modal (z-index 9999).

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

type DropdownPos = { top: number; left: number; width: number };

export function PostComposerTagSelect({
  value,
  onChange,
  isAdmin,
}: PostComposerTagSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Évite l'erreur SSR : createPortal n'a pas accès à document côté serveur.
  useEffect(() => {
    setMounted(true);
  }, []);

  const tags = isAdmin ? ALL_TAGS : ALL_TAGS.filter((t) => !t.adminOnly);
  // Fallback si `value` ne matche aucun tag visible (ex : admin a posté en
  // "annonce" puis a perdu les droits) — on retombe sur "Général".
  const selected = tags.find((t) => t.value === value) ?? tags[0]!;

  const computePos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 160),
    });
  }, []);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open) computePos();
    setOpen((o) => !o);
  }

  // Repositionne au resize / scroll fenêtre tant que le dropdown est ouvert
  useEffect(() => {
    if (!open) return;
    const onLayoutChange = () => computePos();
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [open, computePos]);

  // Close outside
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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const dropdown =
    mounted && open && dropdownPos
      ? createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              minWidth: dropdownPos.width,
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              boxShadow: "var(--nc-shadow-3)",
              padding: 4,
              zIndex: 10010,
              animation: "nc-mode-in 150ms var(--nc-ease) both",
            }}
          >
            {tags.map((t) => (
              <button
                key={t.value}
                type="button"
                role="option"
                aria-selected={t.value === value}
                onClick={() => {
                  onChange(t.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background:
                    t.value === value
                      ? "rgba(224,98,90,0.08)"
                      : "transparent",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  color:
                    t.value === value
                      ? "var(--color-brand)"
                      : "var(--color-text-primary)",
                  fontWeight: t.value === value ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 100ms ease",
                }}
                className={
                  t.value !== value ? "hover:bg-[var(--nc-nav-hover-bg)]" : ""
                }
              >
                {t.label}
                {t.adminOnly && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      marginLeft: 6,
                    }}
                  >
                    Admin
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          border: "1px solid var(--color-border-default)",
          borderRadius: 9999,
          background: "var(--color-surface-card)",
          fontSize: 13,
          color: "var(--color-text-primary)",
          cursor: "pointer",
          fontWeight: 500,
          transition: "border-color 150ms ease",
        }}
        className="hover:border-[rgba(0,0,0,0.20)]"
      >
        {selected.label}
        <ChevronDown
          size={14}
          style={{
            color: "var(--color-text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 180ms ease",
          }}
        />
      </button>
      {dropdown}
    </div>
  );
}
