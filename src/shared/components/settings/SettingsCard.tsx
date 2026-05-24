import type { ReactNode } from "react";

type SettingsCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "danger";
};

export function SettingsCard({
  title,
  description,
  children,
  tone = "default",
}: SettingsCardProps) {
  const isDanger = tone === "danger";
  return (
    <section
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
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2
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
