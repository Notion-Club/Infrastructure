import { Topbar } from "notionclub-infra";

// `transform` crée un containing block : la Topbar (position: fixed; top:0)
// se positionne alors par rapport à ce cadre au lieu du viewport, donc reste
// visible dans le crop de la cellule.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 960,
      height: 84,
      position: "relative",
      transform: "translateZ(0)",
      background: "var(--color-surface-page)",
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);

export const Default = () => (
  <Frame>
    <Topbar />
  </Frame>
);
