import { ThemeToggle } from "notionclub-infra";

export const Segmented = () => (
  <div style={{ padding: 8 }}>
    <ThemeToggle variant="segmented" />
  </div>
);

export const Compact = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8 }}>
    <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
      Thème sombre
    </span>
    <ThemeToggle variant="compact" />
  </div>
);
