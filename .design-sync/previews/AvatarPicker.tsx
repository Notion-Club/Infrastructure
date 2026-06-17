import { AvatarPicker } from "notionclub-infra";

const noop = () => {};

// AvatarPicker is a fixed-overlay modal — it renders full-screen on mount.
export const Default = () => (
  <AvatarPicker
    currentColor="#e0625a"
    currentAvatarUrl={null}
    hasPhoto={false}
    initials="TM"
    isMocked
    onClose={noop}
    onAvatarUpdated={noop}
  />
);

export const CouleurBleue = () => (
  <AvatarPicker
    currentColor="#5b8def"
    currentAvatarUrl={null}
    hasPhoto={false}
    initials="CD"
    isMocked
    onClose={noop}
    onAvatarUpdated={noop}
  />
);
