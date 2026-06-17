import { HostAvatar } from "notionclub-infra";

export const Brand = () => (
  <HostAvatar url={null} initials="TG" bg="#e0625a" size={44} alt="Théo Gouman" />
);

export const Violet = () => (
  <HostAvatar url={null} initials="NL" bg="#7c3aed" size={44} alt="Noah Lemaire" />
);

export const Sizes = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <HostAvatar url={null} initials="MD" bg="#e0625a" size={22} alt="Marie Dupont" />
    <HostAvatar url={null} initials="MD" bg="#e0625a" size={32} alt="Marie Dupont" />
    <HostAvatar url={null} initials="MD" bg="#e0625a" size={44} alt="Marie Dupont" />
    <HostAvatar url={null} initials="MD" bg="#e0625a" size={64} alt="Marie Dupont" />
  </div>
);

export const WithBorder = () => (
  <HostAvatar
    url={null}
    initials="SP"
    bg="#0ea5e9"
    size={48}
    border="2px solid #fff"
    alt="Sophie Petit"
  />
);
