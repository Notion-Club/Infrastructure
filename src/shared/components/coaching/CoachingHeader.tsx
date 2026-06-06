import { Calendar } from "lucide-react";
import { NextCallPill, type NextCallPillData } from "./NextCallPill";

interface CoachingHeaderProps {
  title: string;
  subtitle: string;
  includedPill?: string;
  // V1 live : objet riche (date + host + objet + reschedule URL) — clic ouvre
  // une modale détail. Utilisé pour les vrais appels Notion.
  nextCall?: NextCallPillData;
  // Legacy mock : libellé brut affiché comme un span statique non cliquable.
  // Conservé pour le DevStateSwitcher (mocks accompagnement_*) — à retirer
  // quand tous les états dev tireront sur les vraies données.
  nextCallPill?: string;
}

export function CoachingHeader({
  title,
  subtitle,
  includedPill,
  nextCall,
  nextCallPill,
}: CoachingHeaderProps) {
  return (
    <div
      data-fb-label="En-tête coaching · Coaching"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <h1
        data-fb-label="Titre · En-tête coaching"
        style={{
          fontSize: "clamp(28px, 4vw, 40px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--color-text-primary)",
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        {title}
      </h1>

      <p
        data-fb-label="Sous-titre · En-tête coaching"
        style={{
          fontSize: 15,
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          margin: 0,
          maxWidth: 600,
        }}
      >
        {subtitle}
      </p>

      {/* Pill "1 coaching inclus dans ton offre" — état formation */}
      {includedPill && (
        <div style={{ marginTop: 4 }}>
          <span
            data-fb-label="Badge coaching inclus · En-tête coaching"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              background: "var(--nc-btn-dark-bg)",
              color: "var(--nc-btn-dark-text)",
              borderRadius: 9999,
              padding: "5px 14px",
            }}
          >
            {includedPill}
          </span>
        </div>
      )}

      {/* Pill "Prochain coaching" — V1 live (clickable + modale détail) */}
      {nextCall && <NextCallPill data={nextCall} />}

      {/* Pill "Prochain coaching dans X jours" — legacy mock (non cliquable) */}
      {!nextCall && nextCallPill && (
        <div style={{ marginTop: 4 }}>
          <span
            data-fb-label="Badge prochain coaching · En-tête coaching"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              color: "#e0625a",
              background: "var(--color-surface-card)",
              borderRadius: 9999,
              padding: "5px 14px",
              border: "1px solid rgba(224,98,90,0.25)",
              boxShadow: "0 1px 4px rgba(224,98,90,0.08)",
            }}
          >
            <Calendar size={13} style={{ flexShrink: 0 }} />
            {nextCallPill}
          </span>
        </div>
      )}
    </div>
  );
}
