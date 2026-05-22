"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
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

export function MessageComposer({ onSend, disabled, disabledMessage }: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  // OPS-44 — Lightbox sur la preview d'image / PDF avant envoi. On ouvre
  // au click de la vignette ; on garde l'état "viewing" séparé du
  // pendingFile pour que la fermeture de la lightbox ne supprime pas le
  // fichier en attente.
  const [viewing, setViewing] = useState<PendingFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    if (disabled) return;
    if (pendingFile) {
      onSend(pendingFile.name, pendingFile.type, pendingFile.name);
      if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
      setViewing(null);
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
    const type: "image" | "pdf" = isImage ? "image" : "pdf";
    // OPS-44 — on génère désormais un blob URL pour les images ET les PDF
    // (avant, PDF était previewUrl=null). Nécessaire pour que la lightbox
    // puisse afficher le PDF via <iframe src={url}>.
    const previewUrl = URL.createObjectURL(file);
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
            {/* OPS-44 — clic sur la vignette = ouvrir la lightbox. La croix
                de suppression au coin supérieur droit garde son comportement
                via stopPropagation pour ne pas déclencher l'ouverture. */}
            <button
              type="button"
              onClick={() => setViewing(pendingFile)}
              aria-label={
                pendingFile.type === "image"
                  ? "Agrandir l'image"
                  : "Ouvrir le PDF en grand"
              }
              style={{
                padding: 0,
                margin: 0,
                background: "transparent",
                border: "none",
                cursor: "zoom-in",
                display: "block",
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
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removePendingFile();
              }}
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

      {/* OPS-44 — Lightbox d'agrandissement pour images ET PDF, ouverte au
          click sur la vignette de la preview ci-dessus. */}
      {viewing && viewing.previewUrl && (
        <FileLightbox
          url={viewing.previewUrl}
          name={viewing.name}
          type={viewing.type}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// FileLightbox — overlay plein écran avec backdrop dim + blur. Images
// affichées en `object-fit: contain` à max 90vw/90vh. PDF rendus via
// <iframe> qui s'appuie sur le viewer natif du navigateur (zoom, scroll,
// pagination gérés nativement). Fermeture : click backdrop, bouton X,
// touche Échap. Mode mobile : le pinch-to-zoom navigateur fonctionne sur
// l'image (et l'iframe PDF). Pas de swipe-to-close volontairement — on
// reste sur les 2 affordances explicites (backdrop click + bouton X).
// ============================================================================
function FileLightbox({
  url,
  name,
  type,
  onClose,
}: {
  url: string;
  name: string;
  type: "image" | "pdf";
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        type === "image" ? "Aperçu agrandi de l'image" : "Aperçu agrandi du PDF"
      }
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "nc-mode-in 180ms var(--nc-ease) both",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer l'aperçu"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.12)",
          color: "white",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "background 150ms ease",
        }}
        className="hover:bg-white/25"
      >
        <X size={18} />
      </button>

      {type === "image" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={name}
          style={{
            maxWidth: "90vw",
            maxHeight: "90vh",
            objectFit: "contain",
            borderRadius: 12,
            boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.5)",
            display: "block",
          }}
        />
      ) : (
        <iframe
          src={url}
          title={name}
          style={{
            width: "min(90vw, 1100px)",
            height: "90vh",
            border: "none",
            borderRadius: 12,
            background: "white",
            boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.5)",
            display: "block",
          }}
        />
      )}
    </div>,
    document.body,
  );
}
