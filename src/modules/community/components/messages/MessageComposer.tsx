"use client";

import { useState, useRef } from "react";
import { Paperclip, Send } from "lucide-react";

interface MessageComposerProps {
  onSend: (body: string, type?: "text" | "pdf" | "image", fileName?: string) => void;
  disabled?: boolean;
  disabledMessage?: string;
}

export function MessageComposer({ onSend, disabled, disabledMessage }: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    if (!value.trim() || disabled) return;
    onSend(value.trim(), "text");
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith("image/") ? "image" : "pdf";
    onSend(file.name, type, file.name);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const type = file.type.startsWith("image/") ? "image" : "pdf";
    onSend(file.name, type, file.name);
  }

  if (disabled) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "var(--color-surface-raised)",
          borderTop: "1px solid var(--color-border-default)",
          textAlign: "center",
          fontSize: 13,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
        }}
      >
        {disabledMessage ?? "Conversation désactivée"}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "12px 16px",
        borderTop: "1px solid var(--color-border-default)",
        background: "white",
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {dragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(224,98,90,0.08)",
            border: "2px dashed var(--color-brand)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "var(--color-brand)",
            zIndex: 10,
          }}
        >
          Déposez votre fichier ici
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "1px solid var(--color-border-default)",
          background: "white", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-text-muted)", flexShrink: 0,
          transition: "background 150ms ease",
        }}
        className="hover:bg-[rgba(0,0,0,0.04)]"
        aria-label="Joindre un fichier"
      >
        <Paperclip size={16} />
      </button>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Tapez un message… (Entrée pour envoyer)"
        rows={1}
        style={{
          flex: 1,
          padding: "9px 14px",
          border: "1px solid var(--color-border-default)",
          borderRadius: 20,
          fontSize: 14,
          resize: "none",
          outline: "none",
          fontFamily: "inherit",
          lineHeight: 1.5,
          background: "var(--color-surface-raised)",
          color: "var(--color-text-primary)",
          transition: "border-color 150ms ease",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--color-border-default)")}
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={!value.trim()}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: value.trim() ? "var(--color-brand)" : "#e5e7eb",
          border: "none", cursor: value.trim() ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: value.trim() ? "#fff" : "#9ca3af",
          flexShrink: 0,
          transition: "all 150ms ease",
        }}
        aria-label="Envoyer"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
