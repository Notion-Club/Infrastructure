import { ProfilWidget } from "notionclub-infra";

export const InProgress = () => (
  <div style={{ width: 380 }}>
    <ProfilWidget data={{ level: 5, levelLabel: "Architecte", status: "in_progress", modulesCompleted: 6, modulesTotal: 11 }} />
  </div>
);

export const Completed = () => (
  <div style={{ width: 380 }}>
    <ProfilWidget data={{ level: 9, levelLabel: "Expert", status: "completed", modulesCompleted: 11, modulesTotal: 11 }} />
  </div>
);

export const NotStarted = () => (
  <div style={{ width: 380 }}>
    <ProfilWidget data={{ level: 1, levelLabel: "Débutant", status: "not_started", modulesCompleted: 0, modulesTotal: 11 }} />
  </div>
);
