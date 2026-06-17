import { GoogleButton } from "notionclub-infra";

export const Default = () => (
  <div style={{ width: 340 }}>
    <GoogleButton />
  </div>
);

export const Loading = () => (
  <div style={{ width: 340 }}>
    <GoogleButton loading />
  </div>
);

export const CustomLabel = () => (
  <div style={{ width: 340 }}>
    <GoogleButton label="S'inscrire avec Google" />
  </div>
);
