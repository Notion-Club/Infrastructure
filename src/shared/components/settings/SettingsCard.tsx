import type { ReactNode } from "react";

type SettingsCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "danger";
  fbLabel?: string;
  // Accessoire optionnel rendu à droite du titre (ex. indicateur d'auto-save).
  action?: ReactNode;
};

export function SettingsCard({
  title,
  description,
  children,
  tone = "default",
  fbLabel,
  action,
}: SettingsCardProps) {
  const isDanger = tone === "danger";
  return (
    <section
      data-fb-label={fbLabel ?? "Section réglages · Réglages"}
      style={{
        background: "var(--color-surface-card)",
        border: isDanger
          ? "1px solid rgba(224,98,90,0.35)"
          : "1px solid var(--color-border-default)",
        borderRadius: 20,
        padding: 24,
        boxShadow: "var(--nc-shadow-3)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <h2
            data-fb-label="Titre section · Réglages"
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: isDanger
                ? "var(--color-brand)"
                : "var(--color-text-primary)",
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--color-text-muted)",
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          )}
        </div>
        {action && (
          <div style={{ flexShrink: 0, paddingTop: 2 }}>{action}</div>
        )}
      </header>
      {children}
    </section>
  );
}

export function SettingsDivider() {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        background: "var(--color-border-default)",
        margin: "4px 0",
      }}
    />
  );
}
