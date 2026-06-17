import { EmailField } from "notionclub-infra";

const noop = () => {};

export const Defaut = () => (
  <div style={{ width: 520 }}>
    <EmailField
      platformEmail="theo@notionclub.fr"
      notionEmail=""
      useSeparateNotionEmail={false}
      onPlatformEmailChange={noop}
      onNotionEmailChange={noop}
      onToggleSeparateNotion={noop}
    />
  </div>
);

export const EmailNotionSepare = () => (
  <div style={{ width: 520 }}>
    <EmailField
      platformEmail="theo@notionclub.fr"
      notionEmail="theo.martin@workspace.notion.so"
      useSeparateNotionEmail
      onPlatformEmailChange={noop}
      onNotionEmailChange={noop}
      onToggleSeparateNotion={noop}
    />
  </div>
);

export const Erreur = () => (
  <div style={{ width: 520 }}>
    <EmailField
      platformEmail="theo@notionclub"
      notionEmail=""
      useSeparateNotionEmail={false}
      platformEmailError="Format d'email invalide."
      onPlatformEmailChange={noop}
      onNotionEmailChange={noop}
      onToggleSeparateNotion={noop}
    />
  </div>
);
