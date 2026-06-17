import { AccountSection } from "notionclub-infra";

const baseProfile = {
  id: "preview-user",
  avatar_url: null,
  avatar_color: "#e0625a",
  display_name: "Théo Martin",
  first_name: "Théo",
  last_name: "Martin",
  username: "theo",
  bio: "Créateur de systèmes Notion.",
  phone: "+33 6 12 34 56 78",
  communication_email: null,
  notion_email: null,
};

export const Default = () => (
  <div style={{ width: 560 }}>
    <AccountSection
      profile={baseProfile}
      accountEmail="theo@notionclub.fr"
      isMocked
    />
  </div>
);

export const EmailNotionSepare = () => (
  <div style={{ width: 560 }}>
    <AccountSection
      profile={{ ...baseProfile, notion_email: "theo.martin@workspace.notion.so" }}
      accountEmail="theo@notionclub.fr"
      isMocked
    />
  </div>
);
