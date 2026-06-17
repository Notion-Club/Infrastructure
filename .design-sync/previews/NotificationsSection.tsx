import { NotificationsSection } from "notionclub-infra";

const fullOn = { email: true, in_app: true, whatsapp: true, push: true };
const onlyMailApp = { email: true, in_app: true, whatsapp: false, push: false };
const onlyMail = { email: true, in_app: false, whatsapp: false, push: false };

const baseSettings = {
  preferences: {
    new_modules: { ...fullOn },
    formation_reminders: { ...onlyMailApp },
    coaching_calls: { ...onlyMailApp },
    community_messages: { ...onlyMail },
    billing: { ...onlyMailApp },
  },
  channels: { email: true, in_app: true, whatsapp: true, push: false },
};

export const Default = () => (
  <div style={{ width: 560 }}>
    <NotificationsSection userOffer="coaching" isMocked initialSettings={baseSettings} />
  </div>
);

export const OffreFormation = () => (
  <div style={{ width: 560 }}>
    <NotificationsSection
      userOffer="formation"
      isMocked
      initialSettings={{
        preferences: {
          new_modules: { ...fullOn },
          formation_reminders: { ...onlyMailApp },
          coaching_calls: { ...onlyMail },
          community_messages: { ...onlyMail },
          billing: { ...onlyMail },
        },
        channels: { email: true, in_app: true, whatsapp: false, push: false },
      }}
    />
  </div>
);

export const ParDefaut = () => (
  <div style={{ width: 560 }}>
    <NotificationsSection userOffer="free" isMocked initialSettings={null} />
  </div>
);
