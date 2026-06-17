import { MacOSWindowBar } from "notionclub-infra";

export const WindowMock = () => (
  <div
    style={{
      width: 420,
      borderRadius: "var(--nc-radius-sm)",
      overflow: "hidden",
      border: "1px solid var(--color-border-default)",
      boxShadow: "var(--nc-shadow-2)",
      background: "white",
    }}
  >
    <MacOSWindowBar onClose={() => {}} />
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
        Transcription du coaching
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
        Voici le résumé de la session de coaching du 12 juin. Les points clés
        abordés concernent la structuration de votre espace Notion et la mise en
        place des automatisations communautaires.
      </div>
    </div>
  </div>
);

export const BarOnly = () => (
  <div
    style={{
      width: 360,
      borderRadius: "var(--nc-radius-sm)",
      overflow: "hidden",
      border: "1px solid var(--color-border-default)",
    }}
  >
    <MacOSWindowBar onClose={() => {}} />
  </div>
);
