import { Button } from "notionclub-infra";

export const Variants = () => (
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
    <Button>Continuer</Button>
    <Button variant="secondary">Secondaire</Button>
    <Button variant="outline">Contour</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="destructive">Supprimer</Button>
    <Button variant="link">En savoir plus</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Button size="sm">Petit</Button>
    <Button size="default">Moyen</Button>
    <Button size="lg">Grand</Button>
  </div>
);

export const Disabled = () => <Button disabled>Indisponible</Button>;
