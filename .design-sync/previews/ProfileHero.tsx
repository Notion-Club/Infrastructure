import { ProfileHero } from "notionclub-infra";

const noop = () => {};
const noopAsync = async () => {};

export const Default = () => (
  <div style={{ width: 460, paddingTop: 24, paddingBottom: 24 }}>
    <ProfileHero
      avatarUrl={null}
      avatarColor="#e0625a"
      firstName="Théo"
      lastName="Martin"
      displayName="Théo Martin"
      email="theo@notionclub.fr"
      isMocked
      onAvatarChange={noop}
      onDisplayNameSave={noopAsync}
    />
  </div>
);

export const CouleurViolette = () => (
  <div style={{ width: 460, paddingTop: 24, paddingBottom: 24 }}>
    <ProfileHero
      avatarUrl={null}
      avatarColor="#8a6cf2"
      firstName="Camille"
      lastName="Durand"
      displayName="Camille Durand"
      email="camille@notionclub.fr"
      isMocked
      onAvatarChange={noop}
      onDisplayNameSave={noopAsync}
    />
  </div>
);

export const SansNom = () => (
  <div style={{ width: 460, paddingTop: 24, paddingBottom: 24 }}>
    <ProfileHero
      avatarUrl={null}
      avatarColor="#27ae8e"
      firstName="Léa"
      lastName={null}
      displayName=""
      email="lea@notionclub.fr"
      isMocked
      onAvatarChange={noop}
      onDisplayNameSave={noopAsync}
    />
  </div>
);
