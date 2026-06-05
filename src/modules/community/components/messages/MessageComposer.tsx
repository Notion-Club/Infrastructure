"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Send, X, FileText, Loader2, Reply as ReplyIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadDmFileAction } from "../../server/actions";
import { RichTextEditor } from "@/shared/components/editor/RichTextEditor";

interface PendingFile {
  name: string;
  previewUrl: string | null;
  fileUrl: string | null;
  type: "image" | "pdf";
  uploading: boolean;
}

export interface ReplyContext {
  messageId: string;
  authorName: string;
  snippet: string;
}

interface MessageComposerProps {
  onSend: (
    body: string,
    type?: "text" | "pdf" | "image",
    fileUrl?: string,
    fileName?: string,
  ) => void;
  onTyping?: () => void;
  disabled?: boolean;
  disabledMessage?: string;
  replyContext?: ReplyContext;
  onCancelReply?: () => void;
}

export function MessageComposer({
  onSend,
  onTyping,
  disabled,
  disabledMessage,
  replyContext,
  onCancelReply,
}: MessageComposerProps) {
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyEmpty, setBodyEmpty] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [viewing, setViewing] = useState<PendingFile | null>(null);
  const [mounted, setMounted] = useState(false);
  // resetKey clears the TipTap editor after send
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  function handleSend() {
    if (disabled) return;
    if (pendingFile) {
      if (pendingFile.uploading || !pendingFile.fileUrl) {
        toast.info("Attends la fin de l'upload…");
        return;
      }
      const trimmedText = bodyEmpty ? "" : bodyHtml;
      onSend(trimmedText, pendingFile.type, pendingFile.fileUrl, pendingFile.name);
      if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
      setViewing(null);
      setBodyHtml("");
      setBodyEmpty(true);
      setResetKey((k) => k + 1);
      return;
    }
    if (bodyEmpty) return;
    onSend(bodyHtml, "text");
    setBodyHtml("");
    setBodyEmpty(true);
    setResetKey((k) => k + 1);
  }

  async function attachFile(file: File) {
    const isImage = file.type.startsWith("image/");
    const type: "image" | "pdf" = isImage ? "image" : "pdf";
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    setPendingFile({ name: file.name, previewUrl, fileUrl: null, type, uploading: true });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadDmFileAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPendingFile(null);
        return;
      }
      setPendingFile((prev) =>
        prev ? { ...prev, fileUrl: result.publicUrl, uploading: false } : null,
      );
    } catch (err) {
      console.error("[MessageComposer.attachFile] upload failed:", err);
      toast.error("Échec de l'upload, réessaie.");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPendingFile(null);
    }
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

  const fileReady = pendingFile ? !pendingFile.uploading && !!pendingFile.fileUrl : true;
  const canSend = (!!pendingFile || !bodyEmpty) && fileReady;

  return (
    <div
      style={{
        borderTop: "1px solid var(--color-border-default)",
        background: "var(--color-surface-card)",
        position: "relative",
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) attachFile(file);
      }}
    >
      {dragging && (
        <div
          style={{
            position: "absolute", inset: 0,
            background: "rgba(224,98,90,0.08)",
            border: "2px dashed var(--color-brand)",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "var(--color-brand)", zIndex: 10,
          }}
        >
          Déposez votre fichier ici
        </div>
      )}

      {/* Quote-reply preview */}
      {replyContext && (
        <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "stretch", gap: 10 }}>
          <div style={{ width: 3, borderRadius: 9999, background: "var(--color-brand)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-brand)", fontWeight: 600, marginBottom: 2 }}>
              <ReplyIcon size={12} />
              Réponse à {replyContext.authorName}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {replyContext.snippet}
            </div>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              aria-label="Annuler la réponse"
              style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", flexShrink: 0, alignSelf: "flex-start" }}
              className="hover:bg-[rgba(0,0,0,0.06)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Pending file preview */}
      {pendingFile && (
        <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ position: "relative", display: "inline-flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-border-default)" }}>
            <button
              type="button"
              onClick={() => {
                if (pendingFile.type === "image" && pendingFile.previewUrl) setViewing(pendingFile);
              }}
              aria-label={pendingFile.type === "image" ? "Agrandir l'image" : `Fichier ${pendingFile.name}`}
              style={{ padding: 0, margin: 0, background: "transparent", border: "none", cursor: pendingFile.type === "image" ? "zoom-in" : "default", display: "block" }}
            >
              {pendingFile.type === "image" && pendingFile.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingFile.previewUrl} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: 80, height: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "var(--color-surface-raised)", fontSize: 10, color: "var(--color-text-muted)", padding: 4, textAlign: "center" }}>
                  <FileText size={24} style={{ color: "var(--color-text-secondary)" }} />
                  <span style={{ wordBreak: "break-all", lineHeight: 1.2 }}>{pendingFile.name}</span>
                </div>
              )}
              {pendingFile.uploading && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <Loader2 size={20} color="#fff" className="animate-spin" />
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removePendingFile(); }}
              style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
            >
              <X size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Editor row */}
      <div style={{ padding: "8px 12px 8px 16px", display: "flex", alignItems: "flex-end", gap: 8 }}>
        {/* TipTap editor — replaces textarea */}
        <div
          style={{
            flex: 1,
            border: "1px solid var(--color-border-default)",
            borderRadius: 20,
            overflow: "hidden",
            background: "var(--color-surface-raised)",
            transition: "border-color 150ms ease",
          }}
          onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-brand)"; }}
          onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-default)"; }}
        >
          <RichTextEditor
            key={resetKey}
            placeholder="Tapez un message…"
            minHeight={36}
            onChange={(html, isEmpty) => {
              setBodyHtml(html);
              setBodyEmpty(isEmpty);
              if (!isEmpty) onTyping?.();
            }}
            onImageUpload={async (file) => {
              await attachFile(file);
              // Image is handled via pendingFile, not inline in the body
              return null;
            }}
          />
        </div>

        {/* Send button + upload tooltip */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {pendingFile?.uploading && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                right: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 8,
                padding: "5px 10px",
                fontSize: 12,
                color: "var(--color-text-secondary)",
                whiteSpace: "nowrap",
                boxShadow: "var(--nc-shadow-3)",
              }}
            >
              <span className="nc-blink-dot" style={{ flexShrink: 0 }} />
              Fichier en cours de chargement…
            </div>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: canSend ? "var(--color-brand)" : "var(--nc-btn-disabled-bg)",
              border: "none", cursor: canSend ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: canSend ? "#fff" : "var(--nc-btn-disabled-text)",
              transition: "all 150ms ease",
            }}
            aria-label="Envoyer"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Lightbox for pending image preview */}
      {mounted && viewing && viewing.previewUrl && (
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => { if (e.target === e.currentTarget) setViewing(null); }}
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <button type="button" onClick={() => setViewing(null)}
              style={{ position: "fixed", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewing.previewUrl} alt={viewing.name} style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 12 }} />
          </div>,
          document.body,
        )
      )}
    </div>
  );
}
