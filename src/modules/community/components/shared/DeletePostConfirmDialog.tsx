"use client";

import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { useModalTransition } from "@/shared/lib/hooks/useModalTransition";

interface DeletePostConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeletePostConfirmDialog({ onConfirm, onCancel }: DeletePostConfirmDialogProps) {
  const { stateClass, overlayOpen, requestClose } = useModalTransition();

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        opacity: overlayOpen ? 1 : 0,
        transition: "opacity var(--modal-open-dur) var(--modal-ease)",
      }}
      onClick={() => requestClose(onCancel)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`t-modal ${stateClass} dark:bg-[#1e1e1e]`}
        role="dialog"
        aria-modal="true"
        style={{
          background: "white",
          borderRadius: 20,
          padding: "28px 24px 24px",
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "var(--nc-shadow-2)",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "rgba(224,98,90,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
          }}
        >
          <Trash2 size={22} color="var(--color-brand)" />
        </div>

        {/* Text */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)" }}>
            Supprimer ce post ?
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            Cette action est irréversible. Le post et tous ses commentaires seront définitivement supprimés.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => requestClose(onConfirm)}
            style={{
              padding: "11px 20px",
              background: "var(--color-brand)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 150ms ease",
            }}
            className="hover:opacity-90"
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={() => requestClose(onCancel)}
            style={{
              padding: "11px 20px",
              background: "transparent",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
            className="hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.06)]"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
