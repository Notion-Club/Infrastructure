"use client";

import { useState } from "react";

interface MacOSWindowBarProps {
  onClose: () => void;
}

export function MacOSWindowBar({ onClose }: MacOSWindowBarProps) {
  const [redHovered, setRedHovered] = useState(false);

  return (
    <div
      style={{
        height: 32,
        background: "var(--color-surface-raised)",
        borderBottom: "1px solid var(--color-border-default)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 8,
        flexShrink: 0,
      }}
    >
      {/* Rouge — ferme la modal */}
      <button
        type="button"
        onClick={onClose}
        onMouseEnter={() => setRedHovered(true)}
        onMouseLeave={() => setRedHovered(false)}
        aria-label="Fermer"
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#ff5f57",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          padding: 0,
        }}
      >
        {redHovered && (
          <span
            style={{
              fontSize: 8,
              color: "#4a0000",
              fontWeight: 700,
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            ✕
          </span>
        )}
      </button>

      {/* Jaune — décoratif */}
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#febc2e",
          flexShrink: 0,
          cursor: "default",
        }}
      />

      {/* Vert — décoratif */}
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#28c840",
          flexShrink: 0,
          cursor: "default",
        }}
      />
    </div>
  );
}
