import { NotionBlocks } from "notionclub-infra";

const span = (text: string, extra: Record<string, unknown> = {}) => ({
  text,
  href: null,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  color: "default",
  ...extra,
});

export const LessonDocument = () => (
  <div style={{ width: 640, background: "white", borderRadius: 16, padding: 28 }}>
    <NotionBlocks
      blocks={[
        { id: "h1", type: "heading_1", rich: [span("Structurer sa base CRM dans Notion")] },
        {
          id: "p1",
          type: "paragraph",
          rich: [
            span("Dans cette leçon, on construit une base "),
            span("relationnelle", { bold: true }),
            span(" qui relie tes "),
            span("clients", { color: "blue" }),
            span(", tes projets et tes paiements."),
          ],
        },
        {
          id: "callout",
          type: "callout",
          icon: "💡",
          color: "blue_background",
          rich: [span("Pense à créer la relation AVANT de remplir tes pages — sinon tu devras tout relier à la main.")],
        },
        { id: "h2", type: "heading_2", rich: [span("Les 3 tables essentielles")] },
        { id: "l1", type: "bulleted_list_item", rich: [span("Clients — coordonnées et statut")] },
        { id: "l2", type: "bulleted_list_item", rich: [span("Projets — liés à un client")] },
        { id: "l3", type: "bulleted_list_item", rich: [span("Paiements — liés à un projet")] },
        {
          id: "quote",
          type: "quote",
          rich: [span("Une bonne base CRM, c'est 20 % de structure et 80 % de discipline.")],
        },
        {
          id: "code",
          type: "code",
          language: "javascript",
          rich: [span('prop("Montant") * prop("Taux TVA")')],
        },
      ]}
    />
  </div>
);

export const ChecklistAndTodos = () => (
  <div style={{ width: 560, background: "white", borderRadius: 16, padding: 28 }}>
    <NotionBlocks
      blocks={[
        { id: "h3", type: "heading_3", rich: [span("Avant de passer à la suite")] },
        { id: "t1", type: "to_do", checked: true, rich: [span("Créer la table Clients")] },
        { id: "t2", type: "to_do", checked: true, rich: [span("Ajouter la relation Projets ↔ Clients")] },
        { id: "t3", type: "to_do", checked: false, rich: [span("Configurer la vue Kanban par statut")] },
        { id: "t4", type: "to_do", checked: false, rich: [span("Importer tes 5 premiers clients")] },
        { id: "div", type: "divider" },
        {
          id: "num1",
          type: "numbered_list_item",
          rich: [span("Ouvre ta base Notion")],
        },
        {
          id: "num2",
          type: "numbered_list_item",
          rich: [span("Clique sur "), span("+ Nouvelle vue", { code: true })],
        },
        {
          id: "num3",
          type: "numbered_list_item",
          rich: [span("Choisis "), span("Tableau Kanban", { bold: true })],
        },
      ]}
    />
  </div>
);

export const CalloutAndToggle = () => (
  <div style={{ width: 560, background: "white", borderRadius: 16, padding: 28 }}>
    <NotionBlocks
      blocks={[
        {
          id: "warn",
          type: "callout",
          icon: "⚠️",
          color: "yellow_background",
          rich: [span("Ne supprime jamais une propriété de relation utilisée par une rollup.")],
        },
        {
          id: "tog",
          type: "toggle",
          rich: [span("Pourquoi utiliser des rollups ?")],
          children: [
            {
              id: "tog-p",
              type: "paragraph",
              rich: [span("Une rollup agrège les données liées — par exemple le total des paiements d'un client.")],
            },
          ],
        },
        {
          id: "succ",
          type: "callout",
          icon: "✅",
          color: "green_background",
          rich: [span("Bravo, ta base est maintenant 100 % relationnelle.")],
        },
      ]}
    />
  </div>
);
