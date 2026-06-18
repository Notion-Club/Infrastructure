"use client";

import { ThemeToggle } from "@/shared/components/theme/ThemeToggle";

/**
 * Section « Apparence » — déplacée des Réglages vers le menu compte
 * (dropdown avatar Topbar / MobileTopActions). On garde le sélecteur de thème
 * segmenté d'origine (Light / Système / Dark) plutôt qu'un simple toggle
 * binaire, pour préserver le choix « système ». Mise en page verticale
 * (label au-dessus du switcher) afin de tenir dans la largeur du dropdown.
 */
export function AppearanceSection() {
  return (
    <div
      data-fb-label="Section apparence · Menu compte"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "6px 10px 8px",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--color-text-muted)",
        }}
      >
        Apparence
      </span>
      <div data-fb-label="Switcher de thème · Section apparence" style={{ display: "flex" }}>
        <ThemeToggle variant="segmented" />
      </div>
    </div>
  );
}
