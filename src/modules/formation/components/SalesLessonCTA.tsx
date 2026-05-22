"use client";

import { Phone } from "lucide-react";

import { MOCK_MEMBER } from "../mocks/formation.mock";

type Props = { lessonId: string; onClick: () => void };

const FILLOUT_URL = "https://fillout.com/PLACEHOLDER";

// CTA proéminent pour les sales lessons (dernière leçon du Challenge).
// Remplace le bouton "J'ai terminé" classique. Au clic : marque la leçon
// comme complétée + ouvre Fillout dans un nouvel onglet avec member_id
// et email pré-remplis.
export function SalesLessonCTA({ onClick }: Props) {
  function handleClick() {
    onClick();
    const params = new URLSearchParams({
      member_id: MOCK_MEMBER.memberId,
      email: MOCK_MEMBER.email,
    });
    window.open(
      `${FILLOUT_URL}?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "center",
        textAlign: "center",
        padding: "32px 24px",
        background:
          "linear-gradient(135deg, rgba(224,98,90,0.08), rgba(224,98,90,0.02))",
        border: "1px solid rgba(224,98,90,0.20)",
        borderRadius: 20,
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="nc-btn-shine"
        style={{
          background: "var(--color-brand)",
          color: "white",
          border: "none",
          borderRadius: 9999,
          padding: "16px 32px",
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 12px 32px -8px rgba(224,98,90,0.6)",
          transition: "transform 200ms ease, box-shadow 200ms ease",
          letterSpacing: "-0.01em",
        }}
      >
        <Phone size={18} fill="currentColor" strokeWidth={0} />
        Réserver mon call
      </button>
      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary)",
          margin: 0,
          maxWidth: 360,
          lineHeight: 1.5,
        }}
      >
        Tu vas être redirigé vers la prise de RDV avec Théo.
      </p>
    </div>
  );
}
