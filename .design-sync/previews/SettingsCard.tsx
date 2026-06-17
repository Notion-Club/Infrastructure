import { SettingsCard, SettingsDivider } from "notionclub-infra";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
        {label}
      </span>
      <input
        className="nc-input"
        defaultValue={value}
        readOnly
      />
    </div>
  );
}

export const Default = () => (
  <div style={{ width: 560 }}>
    <SettingsCard
      title="Compte & connexion"
      description="Informations privées de connexion et de facturation. Elles ne sont jamais affichées dans la communauté."
    >
      <Row label="Adresse e-mail" value="theo@notionclub.fr" />
      <SettingsDivider />
      <Row label="Numéro de téléphone" value="+33 6 12 34 56 78" />
    </SettingsCard>
  </div>
);

export const Danger = () => (
  <div style={{ width: 560 }}>
    <SettingsCard
      tone="danger"
      title="Zone de danger"
      description="La suppression de votre compte est définitive. Toutes vos formations et messages seront perdus."
    >
      <button
        type="button"
        style={{
          alignSelf: "flex-start",
          padding: "10px 20px",
          borderRadius: 9999,
          border: "1px solid rgba(224,98,90,0.35)",
          background: "var(--color-surface-card)",
          color: "var(--color-brand)",
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Supprimer mon compte
      </button>
    </SettingsCard>
  </div>
);

export const SansDescription = () => (
  <div style={{ width: 560 }}>
    <SettingsCard title="Apparence">
      <Row label="Thème de l'application" value="Système" />
    </SettingsCard>
  </div>
);
