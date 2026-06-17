import { GoogleLogo } from "notionclub-infra";

export const Sizes = () => (
  <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
    <GoogleLogo className="size-5" />
    <GoogleLogo className="size-6" />
    <GoogleLogo className="size-8" />
    <GoogleLogo className="size-10" />
  </div>
);

export const InContext = () => (
  <div
    style={{
      display: "flex",
      width: 340,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      borderRadius: "var(--nc-radius-xl)",
      border: "1px dashed var(--color-border-default)",
      background: "var(--color-surface-raised)",
      padding: "12px 20px",
      fontSize: 15,
      fontWeight: 500,
      color: "var(--color-text-primary)",
    }}
  >
    <GoogleLogo className="size-5" />
    Continuer avec Google
  </div>
);
