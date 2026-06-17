import { BottomNav } from "notionclub-infra";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 390,
      height: 160,
      position: "relative",
      transform: "translateZ(0)",
      background: "var(--color-surface-page)",
      borderRadius: 24,
      overflow: "hidden",
    }}
  >
    {/* Faux contenu de page derrière la pill */}
    <div
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          height: 14,
          width: "60%",
          borderRadius: 6,
          background: "var(--color-border-default)",
        }}
      />
      <div
        style={{
          height: 14,
          width: "40%",
          borderRadius: 6,
          background: "var(--color-border-default)",
        }}
      />
    </div>
    {children}
  </div>
);

export const Default = () => (
  <Frame>
    <BottomNav />
  </Frame>
);
