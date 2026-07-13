import { dayLabel } from "../../utils/date-helpers";

// Séparateur de chronologie entre deux jours dans le thread de messages
// privés : ligne ondulée de part et d'autre d'une date centrée
// (« Lundi 13 Juillet 2026 »). L'ondulation est un span masqué par un motif
// SVG répété (.nc-day-sep-wave, cf. globals.css) — le fond du span porte la
// couleur, qui suit donc le thème light/dark sans dupliquer le SVG.
// Server-compatible (aucun état) ; inséré par ConversationThread avant le
// premier message de chaque jour calendaire.
export function MessageDaySeparator({ dateStr }: { dateStr: string }) {
  const label = dayLabel(dateStr);
  return (
    <div
      role="separator"
      aria-label={label}
      data-fb-label="Séparateur de jour · Thread de messages"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        // Respiration supérieure plus marquée : le séparateur clôt la journée
        // précédente et introduit la suivante.
        margin: "14px 0 8px",
        flexShrink: 0,
      }}
    >
      <span aria-hidden className="nc-day-sep-wave" />
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--color-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span aria-hidden className="nc-day-sep-wave" />
    </div>
  );
}
