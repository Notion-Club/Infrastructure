import { SecuritySection } from "notionclub-infra";

export const MotDePasse = () => (
  <div style={{ width: 560 }}>
    <SecuritySection
      isMocked
      user={{
        id: "preview-user",
        email: "theo@notionclub.fr",
        identities: [{ provider: "email", identity_data: { email: "theo@notionclub.fr" } }],
      }}
    />
  </div>
);

export const AvecGoogle = () => (
  <div style={{ width: 560 }}>
    <SecuritySection
      isMocked
      user={{
        id: "preview-user",
        email: "theo@notionclub.fr",
        identities: [
          { provider: "email", identity_data: { email: "theo@notionclub.fr" } },
          { provider: "google", identity_data: { email: "theo.martin@gmail.com" } },
        ],
      }}
    />
  </div>
);

export const GoogleSeul = () => (
  <div style={{ width: 560 }}>
    <SecuritySection
      isMocked
      user={{
        id: "preview-user",
        email: "theo@notionclub.fr",
        identities: [{ provider: "google", identity_data: { email: "theo.martin@gmail.com" } }],
      }}
    />
  </div>
);
