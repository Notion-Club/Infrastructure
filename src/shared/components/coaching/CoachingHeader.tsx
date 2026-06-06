import { NextCallPill, type NextCallPillData } from "./NextCallPill";

interface CoachingHeaderProps {
  title: string;
  subtitle: string;
  includedPill?: string;
  // Objet riche live (date + host + objet + reschedule URL) — clic ouvre une
  // modale détail. Source : DB Notion Appels de suivi. Masqué si null.
  nextCall?: NextCallPillData;
}

export function CoachingHeader({
  title,
  subtitle,
  includedPill,
  nextCall,
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

      {/* Pill "Prochain coaching" — live (clickable + modale détail) */}
      {nextCall && <NextCallPill data={nextCall} />}
    </div>
  );
}
