"use client";

import { ArrowRight, Sparkles } from "lucide-react";

import { useFormationContext } from "../hooks/useFormationMocks";
import { ProgramCard } from "./ProgramCard";

// Page d'index de Formation. Liste les programmes accessibles selon la
// capability courante (issue du toggle dev). Les 4 cas sont :
//   - paid + challenge → 2 cards (paid en premier)
//   - paid_only        → 1 card
//   - challenge_only   → 1 card + upsell discret
//   - none             → empty state
export function FormationIndexClient() {
  const { programs, capabilities, progress } = useFormationContext();

  const hasPaid = capabilities.includes("can_access_paid_programs");
  const hasChallenge = capabilities.includes("can_access_challenge_program");

  const paid = programs.find(
    (p) => p.requiredCapability === "can_access_paid_programs",
  );
  const challenge = programs.find(
    (p) => p.requiredCapability === "can_access_challenge_program",
  );

  if (!hasPaid && !hasChallenge) {
    return <EmptyState />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            fontWeight: 500,
          }}
        >
          Formation
        </span>
        <h1
          style={{
            fontSize: "clamp(32px, 4vw, 44px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Tes programmes
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--color-text-secondary)",
            margin: 0,
            maxWidth: 560,
            lineHeight: 1.5,
          }}
        >
          Reprends là où tu en étais, ou démarre un nouveau programme.
        </p>
      </header>

      {hasPaid && paid && (
        <ProgramCard program={paid} progress={progress} />
      )}
      {hasChallenge && challenge && (
        <ProgramCard program={challenge} progress={progress} />
      )}

      {hasChallenge && !hasPaid && paid && <UpsellCard />}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        marginTop: 32,
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 20,
        padding: "48px 32px",
        textAlign: "center",
        boxShadow: "var(--nc-shadow-3)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <Sparkles size={32} style={{ color: "var(--color-brand)" }} />
      <div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Tu n&apos;as pas encore accès à un programme.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            margin: "8px 0 0 0",
            maxWidth: 420,
            lineHeight: 1.5,
          }}
        >
          Démarre par le challenge gratuit pour découvrir Notion Club, ou
          regarde nos offres complètes.
        </p>
      </div>
      <a
        href="#"
        style={{
          background: "var(--color-brand)",
          color: "white",
          borderRadius: 9999,
          padding: "10px 22px",
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
        }}
        className="nc-btn-shine"
      >
        Découvrir nos offres
        <ArrowRight size={14} />
      </a>
    </div>
  );
}

function UpsellCard() {
  return (
    <a
      href="#"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background:
          "linear-gradient(110deg, rgba(224,98,90,0.08), rgba(224,98,90,0.02))",
        border: "1px solid rgba(224,98,90,0.20)",
        borderRadius: 18,
        padding: "18px 22px",
        textDecoration: "none",
        transition: "border-color 200ms ease, transform 200ms ease",
      }}
      className="hover:border-[rgba(224,98,90,0.40)] hover:-translate-y-0.5"
    >
      <Sparkles
        size={22}
        style={{ color: "var(--color-brand)", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          Passe à l&apos;étape suivante avec Devenir consultant Notion
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            margin: "2px 0 0 0",
          }}
        >
          Le programme complet pour faire du consulting Notion ton métier.
        </p>
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-brand)",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}
      >
        En savoir plus <ArrowRight size={14} />
      </span>
    </a>
  );
}
