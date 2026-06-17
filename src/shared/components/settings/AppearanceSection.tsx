"use client";

import { SettingsCard } from "./SettingsCard";
import { ThemeToggle } from "@/shared/components/theme/ThemeToggle";

export function AppearanceSection() {
  return (
    <SettingsCard
      title="Apparence"
      description="Choisissez le thème de l'application — clair, sombre, ou aligné sur votre système."
      fbLabel="Section apparence · Réglages"
    >
      <div
        data-fb-label="Switcher de thème · Section apparence"
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "4px 0",
        }}
      >
        <ThemeToggle variant="segmented" />
      </div>
    </SettingsCard>
  );
}
