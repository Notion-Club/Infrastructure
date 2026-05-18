"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { SettingsCard } from "./SettingsCard";

const SUPPORT_EMAIL = "support@notionclub.fr";

export function DangerZone() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <SettingsCard
      title="Zone de danger"
      description="La suppression de votre compte est définitive. Toutes vos données seront effacées."
      tone="danger"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 9999,
            border: "1px solid rgba(224,98,90,0.4)",
            background: "white",
            color: "var(--color-brand)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
          className="hover:bg-[rgba(224,98,90,0.06)]"
        >
          <Trash2 size={14} />
          Supprimer mon compte
        </button>
        {showInfo && (
          <div
            role="status"
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid rgba(224,98,90,0.3)",
              background: "rgba(224,98,90,0.06)",
              fontSize: 13,
              color: "var(--color-text-secondary)",
              lineHeight: 1.55,
            }}
          >
            Pour supprimer votre compte, contactez-nous à{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{
                color: "var(--color-brand)",
                fontWeight: 600,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
