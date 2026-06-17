import { GradualBlurOverlay } from "notionclub-infra";

const SampleContent = ({ padTop = 16 }: { padTop?: number }) => (
  <div
    style={{
      paddingTop: padTop,
      paddingLeft: 16,
      paddingRight: 16,
      paddingBottom: 16,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    {[
      "Module 6 — Bases de données Notion",
      "Créer une vue Galerie filtrée",
      "Relations et rollups avancés",
      "Automatiser avec les boutons",
      "Synchroniser deux bases",
      "Exporter vers le CRM communauté",
      "Modèle de tableau de bord",
    ].map((t, i) => (
      <div
        key={i}
        style={{
          background: "white",
          borderRadius: "var(--nc-radius-sm)",
          padding: "14px 16px",
          fontSize: 14,
          fontWeight: 500,
          color: "var(--color-text-primary)",
          boxShadow: "var(--nc-shadow-3)",
        }}
      >
        {t}
      </div>
    ))}
  </div>
);

export const BottomFade = () => (
  <div
    style={{
      position: "relative",
      width: 340,
      height: 320,
      overflow: "hidden",
      borderRadius: "var(--nc-radius-md)",
      background: "#f5f2f2",
      border: "1px solid var(--color-border-default)",
    }}
  >
    <SampleContent />
    <GradualBlurOverlay position="sticky" anchor="bottom" height={120} />
  </div>
);

export const TopFade = () => (
  <div
    style={{
      position: "relative",
      width: 340,
      height: 320,
      overflow: "hidden",
      borderRadius: "var(--nc-radius-md)",
      background: "#f5f2f2",
      border: "1px solid var(--color-border-default)",
    }}
  >
    <GradualBlurOverlay position="sticky" anchor="top" height={110} />
    <SampleContent padTop={4} />
  </div>
);
