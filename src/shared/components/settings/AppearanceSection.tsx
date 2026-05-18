"use client";

import { SettingsCard } from "./SettingsCard";
import { ThemeToggle } from "@/shared/components/theme/ThemeToggle";

export function AppearanceSection() {
  return (
    <SettingsCard
      title="Apparence"
      description="Personnalisez l'apparence de l'application."
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "4px 0",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-text-primary)",
            }}
          >
            Thème
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}
          >
            Choisissez le mode clair ou sombre.
          </p>
        </div>
        <ThemeToggle variant="segmented" />
      </div>
    </SettingsCard>
  );
}
