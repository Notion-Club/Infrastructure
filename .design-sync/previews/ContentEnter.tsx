import { ContentEnter } from "notionclub-infra";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 520, background: "var(--color-surface-page)", padding: 24 }}>
    {children}
  </div>
);

const Card = ({ title, body }: { title: string; body: string }) => (
  <div
    style={{
      background: "var(--color-surface-card)",
      border: "1px solid var(--color-border-default)",
      borderRadius: 16,
      padding: 20,
      boxShadow: "var(--nc-shadow-3)",
    }}
  >
    <h3
      style={{
        margin: "0 0 6px",
        fontSize: 16,
        fontWeight: 600,
        color: "var(--color-text-primary)",
      }}
    >
      {title}
    </h3>
    <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)" }}>
      {body}
    </p>
  </div>
);

// Apparition simple d'un bloc de contenu (opacity + translateY).
export const Simple = () => (
  <Frame>
    <ContentEnter>
      <Card
        title="Bienvenue dans ton espace"
        body="Reprends ta formation là où tu t'es arrêté et planifie ton prochain appel de coaching."
      />
    </ContentEnter>
  </Frame>
);

// Apparition en cascade des enfants directs (stagger).
export const Stagger = () => (
  <Frame>
    <ContentEnter stagger style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card
        title="Formation en cours"
        body="Module 6 — Bases de données avancées · 58 % complété."
      />
      <Card
        title="Prochain appel"
        body="Aide setup CRM client avec Théo, lundi à 14h."
      />
      <Card
        title="Communauté"
        body="3 nouveaux messages dans le canal #notion-tips."
      />
    </ContentEnter>
  </Frame>
);
