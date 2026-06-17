import { MobileTopActions } from "notionclub-infra";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 390,
      height: 120,
      position: "relative",
      transform: "translateZ(0)",
      background: "var(--color-surface-page)",
      borderRadius: 24,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary)",
        }}
      >
        Bon retour
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--color-text-primary)",
        }}
      >
        Théo
      </span>
    </div>
    {children}
  </div>
);

export const Default = () => (
  <Frame>
    <MobileTopActions />
  </Frame>
);
