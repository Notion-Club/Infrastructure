import { Input } from "notionclub-infra";

export const Default = () => (
  <div style={{ width: 320 }}>
    <Input defaultValue="Théo Martin" />
  </div>
);

export const Placeholder = () => (
  <div style={{ width: 320 }}>
    <Input placeholder="votre@email.com" type="email" />
  </div>
);

export const Disabled = () => (
  <div style={{ width: 320 }}>
    <Input defaultValue="membre@notionclub.fr" disabled />
  </div>
);

export const Invalid = () => (
  <div style={{ width: 320 }}>
    <Input defaultValue="email-invalide" aria-invalid />
  </div>
);
