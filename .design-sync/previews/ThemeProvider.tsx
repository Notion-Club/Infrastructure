import { ThemeProvider, ThemeToggle } from "notionclub-infra";

// ThemeProvider has no visual of its own — it supplies theme context. The
// canonical demonstration is wrapping a consumer (ThemeToggle) that reads it.
export const WrappingThemeToggle = () => (
  <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
      Préférence de thème
    </span>
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  </div>
);
