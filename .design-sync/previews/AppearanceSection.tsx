import { AppearanceSection, ThemeProvider } from "notionclub-infra";

export const Default = () => (
  <ThemeProvider>
    <div style={{ width: 560 }}>
      <AppearanceSection />
    </div>
  </ThemeProvider>
);
