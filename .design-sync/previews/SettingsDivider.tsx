import { SettingsDivider } from "notionclub-infra";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>{value}</span>
    </div>
  );
}

export const EntreDeuxLignes = () => (
  <div
    style={{
      width: 520,
      padding: 24,
      borderRadius: 20,
      border: "1px solid var(--color-border-default)",
      background: "var(--color-surface-card)",
      boxShadow: "var(--nc-shadow-3)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}
  >
    <Row label="Adresse e-mail" value="theo@notionclub.fr" />
    <SettingsDivider />
    <Row label="Numéro de téléphone" value="+33 6 12 34 56 78" />
    <SettingsDivider />
    <Row label="Compte Google" value="theo.martin@gmail.com" />
  </div>
);
