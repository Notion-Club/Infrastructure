import { useState } from "react";
import { CoachingDevTools } from "notionclub-infra";

type UserState =
  | "free"
  | "formation_0_calls"
  | "formation_1_call"
  | "accompagnement_eligible"
  | "accompagnement_not_eligible"
  | "accompagnement_expired";

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: "var(--color-surface-page)", padding: 20 }}>
    <div
      className="nc-dropdown-panel"
      style={{
        width: 280,
        borderRadius: 16,
        padding: 8,
      }}
    >
      {children}
    </div>
  </div>
);

// État par défaut : « Accompagnement éligible » sélectionné.
export const Default = () => {
  const [state, setState] = useState<UserState>("accompagnement_eligible");
  return (
    <Panel>
      <CoachingDevTools current={state} onChange={setState} />
    </Panel>
  );
};

// Premier état de la liste sélectionné (Challenge Gratuit).
export const ChallengeGratuit = () => {
  const [state, setState] = useState<UserState>("free");
  return (
    <Panel>
      <CoachingDevTools current={state} onChange={setState} />
    </Panel>
  );
};

// État expiré sélectionné (dernier toggle).
export const Expire = () => {
  const [state, setState] = useState<UserState>("accompagnement_expired");
  return (
    <Panel>
      <CoachingDevTools current={state} onChange={setState} />
    </Panel>
  );
};
