"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil } from "lucide-react";

import { useFormationContext } from "../hooks/useFormationMocks";

type Props = { lessonId: string };

const MAX = 50_000;
const WARN_THRESHOLD = 0.8;

// Textarea pour les notes perso de la leçon. La source de vérité du
// contenu est le contexte (`progress.lessonNotes[lessonId]`). On lit
// directement depuis lui à chaque render — pas de useState local pour
// la valeur. Le composant doit être remonté (key={lessonId}) quand
// l'utilisateur change de leçon pour reset `savedAt`.
export function LessonNotes({ lessonId }: Props) {
  const { progress, setNote } = useFormationContext();
  const value = progress.lessonNotes[lessonId] ?? "";
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize hauteur — side effect DOM externe, pas un setState.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(220, el.scrollHeight) + "px";
  }, [value]);

  function onChange(next: string) {
    if (next.length > MAX) return;
    setNote(lessonId, next);
    setSavedAt(null);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setSavedAt(Date.now()), 800);
  }

  const showCounter = value.length >= MAX * WARN_THRESHOLD;
  const justSaved = savedAt !== null;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 18,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "var(--nc-shadow-3)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Pencil size={13} style={{ color: "var(--color-brand)" }} />
          Mes notes
        </h3>

        <span
          style={{
            fontSize: 11,
            color: justSaved
              ? "var(--color-brand)"
              : "var(--color-text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            opacity: justSaved ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        >
          <Check size={12} />
          Sauvegardé
        </span>
      </header>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Note ici ce que tu retiens de cette leçon — questions, idées, exemples…"
        style={{
          width: "100%",
          minHeight: 220,
          border: "1px solid var(--color-border-default)",
          borderRadius: 12,
          padding: 14,
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--color-text-primary)",
          fontFamily: "inherit",
          resize: "none",
          outline: "none",
          background: "var(--color-surface-raised)",
          transition:
            "border-color 200ms ease, box-shadow 200ms ease, background 200ms ease",
        }}
        className="focus:bg-white focus:border-[rgba(224,98,90,0.4)] focus:shadow-[0_0_0_3px_rgba(224,98,90,0.10)]"
      />

      {showCounter && (
        <p
          style={{
            fontSize: 11,
            color:
              value.length >= MAX
                ? "var(--color-brand)"
                : "var(--color-text-muted)",
            margin: 0,
            textAlign: "right",
          }}
        >
          {value.length.toLocaleString("fr-FR")} / {MAX.toLocaleString("fr-FR")}{" "}
          caractères
        </p>
      )}
    </div>
  );
}
