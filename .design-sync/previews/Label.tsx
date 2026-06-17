import { Label, Input } from "notionclub-infra";

export const WithInput = () => (
  <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 8 }}>
    <Label htmlFor="prenom">Prénom</Label>
    <Input id="prenom" placeholder="Théo" />
  </div>
);

export const Standalone = () => (
  <div style={{ width: 320 }}>
    <Label>Adresse e-mail</Label>
  </div>
);

export const DisabledField = () => (
  <div
    className="group"
    data-disabled="true"
    style={{ width: 320, display: "flex", flexDirection: "column", gap: 8 }}
  >
    <Label htmlFor="email-d">E-mail (non modifiable)</Label>
    <Input id="email-d" defaultValue="membre@notionclub.fr" disabled />
  </div>
);
