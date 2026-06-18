"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle } from "lucide-react";

// ConfirmDialog — petit dialogue de confirmation générique aligné sur la DA
// (portail, voile flou, carte surface-card). Deux actions : une primaire
// (brand) et une secondaire. Le dismiss (clic voile / Échap) = ne rien faire.

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  onDismiss: () => void;
  busy?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  secondaryLabel,
  onSecondary,
  onDismiss,
  busy = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onDismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onDismiss]);

  if (!open) return null;

  return createPortal(
    <div
      className="nc-modal-overlay"
      style={{ zIndex: 240 }}
      onClick={() => {
        if (!busy) onDismiss();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="nc-modal-card nc-modal-card--sm"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 22 }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 700,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13.5,
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            marginTop: 20,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onSecondary}
            disabled={busy}
            data-fb-label="Bouton secondaire · Dialogue de confirmation"
            style={{
              padding: "10px 16px",
              borderRadius: 9999,
              border: "1px solid var(--color-border-default)",
              background: "var(--color-surface-card)",
              color: "var(--color-text-primary)",
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            data-fb-label="Bouton primaire · Dialogue de confirmation"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 9999,
              border: "none",
              background: "var(--color-brand)",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
              boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
            }}
          >
            {busy && <LoaderCircle size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
