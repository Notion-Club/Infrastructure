import { useState } from "react";
import { CoachingTabs } from "notionclub-infra";
import { Calendar, History } from "lucide-react";

export const History_vs_Upcoming = () => {
  const [active, setActive] = useState<"upcoming" | "past">("upcoming");
  return (
    <div style={{ width: 420 }}>
      <CoachingTabs
        active={active}
        onChange={setActive}
        ariaLabel="Filtrer les appels"
        tabs={[
          { value: "upcoming", label: "À venir", icon: <Calendar size={15} /> },
          { value: "past", label: "Passés", icon: <History size={15} /> },
        ]}
      />
    </div>
  );
};

export const PastActive = () => {
  const [active, setActive] = useState<"upcoming" | "past">("past");
  return (
    <div style={{ width: 420 }}>
      <CoachingTabs
        active={active}
        onChange={setActive}
        ariaLabel="Filtrer les appels"
        tabs={[
          { value: "upcoming", label: "À venir", icon: <Calendar size={15} /> },
          { value: "past", label: "Passés", icon: <History size={15} /> },
        ]}
      />
    </div>
  );
};

export const ModalTabs = () => {
  const [active, setActive] = useState<"plan" | "transcript">("plan");
  return (
    <div style={{ width: 420 }}>
      <CoachingTabs
        active={active}
        onChange={setActive}
        ariaLabel="Onglets de la modale détail"
        tabs={[
          { value: "plan", label: "Plan d'actions" },
          { value: "transcript", label: "Transcription" },
        ]}
      />
    </div>
  );
};
