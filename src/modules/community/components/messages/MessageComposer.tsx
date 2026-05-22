"use client";

import { useEffect, useState, useRef } from "react";
import { Paperclip, Send, X, FileText } from "lucide-react";

interface PendingFile {
  name: string;
  previewUrl: string | null;
  type: "image" | "pdf";
}

interface MessageComposerProps {
  onSend: (body: string, type?: "text" | "pdf" | "image", fileName?: string) => void;
  disabled?: boolean;
  disabledMessage?: string;
}

// Détection navigateur Mac — sur Mac on remplace le mot "Entrée" par
// l'icône ⌘ dans le hint du textarea, pour s'aligner sur la convention
// visuelle macOS. Calculé côté client uniquement (SSR-safe via useEffect).
function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || "";
  const ua = navigator.userAgent || "";
  return /Mac|iPhone|iPod|iPad/i.test(platform) || /Macintosh/i.test(ua);
}

export function MessageComposer({ onSend, disabled, disabledMessage }: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [isMac, setIsMac] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hydratation : on calcule isMac une fois côté client pour éviter un
  // mismatch SSR (server n'a pas navigator).
  useEffect(() => {
    setIsMac(detectMac());
  }, []);

  function handleSend() {
    if (disabled) return;
    if (pendingFile) {
      onSend(pendingFile.name, pendingFile.type, pendingFile.name);
      if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
      return;
    }
    if (!value.trim()) return;
    onSend(value.trim(), "text");
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function attachFile(file: File) {
    const isImage = file.type.startsWith("image/");
    const type = isImage ? "image" : "pdf";
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    setPendingFile({ name: file.name, previewUrl, type });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    attachFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) attachFile(file);
  }

  function removePendingFile() {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
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

  const canSend = !!pendingFile || value.trim().length > 0;

  return (
    <div
      style={{
        borderTop: "1px solid var(--color-border-default)",
        background: "white",
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

      {/* Pending file preview */}
      {pendingFile && (
        <div
          style={{
            padding: "10px 16px 0",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid var(--color-border-default)",
            }}
          >
            {pendingFile.type === "image" && pendingFile.previewUrl ? (
              <img
                src={pendingFile.previewUrl}
                alt="preview"
                style={{ width: 80, height: 80, objectFit: "cover", display: "block" }}
              />
            ) : (
              <div
                style={{
                  width: 80, height: 80, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4,
                  background: "var(--color-surface-raised)", fontSize: 10,
                  color: "var(--color-text-muted)", padding: 4, textAlign: "center",
                }}
              >
                <FileText size={24} style={{ color: "var(--color-text-secondary)" }} />
                <span style={{ wordBreak: "break-all", lineHeight: 1.2 }}>{pendingFile.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={removePendingFile}
              style={{
                position: "absolute", top: 4, right: 4,
                width: 20, height: 20, borderRadius: "50%",
                background: "rgba(0,0,0,0.55)", border: "none",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", color: "#fff",
              }}
            >
              <X size={11} />
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "12px 16px", display: "flex", alignItems: "flex-end", gap: 8 }}>
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
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onInput={handleTextareaInput}
          onKeyDown={handleKeyDown}
          placeholder={`Tapez un message… (${isMac ? "⌘" : "Entrée"} pour envoyer)`}
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
            transition: "border-color 150ms ease, height 150ms ease",
            overflow: "hidden",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--color-border-default)")}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: canSend ? "var(--color-brand)" : "#e5e7eb",
            border: "none", cursor: canSend ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: canSend ? "#fff" : "#9ca3af",
            flexShrink: 0,
            transition: "all 150ms ease",
          }}
          aria-label="Envoyer"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
