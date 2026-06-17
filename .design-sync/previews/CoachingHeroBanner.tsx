import { CoachingHeroBanner } from "notionclub-infra";

export const Default = () => (
  <div style={{ width: 760 }}>
    <CoachingHeroBanner
      title="Ton accompagnement personnalisé"
      description="Réserve un appel en 1:1 avec ton coach pour débloquer ta progression sur Notion et avancer sur ton projet concret."
      accroche="Passe au niveau supérieur"
      button={{ label: "Réserver un appel" }}
    />
  </div>
);

export const WithNextCall = () => (
  <div style={{ width: 760 }}>
    <CoachingHeroBanner
      title="Bon retour, Théo"
      description="Ton coach a préparé la session autour de ton setup CRM. Pense à noter tes questions en amont pour gagner du temps."
      accroche="Ta prochaine session est calée"
      button={{ label: "Réserver un appel" }}
      nextCall={{
        scheduledAt: "2026-06-22T14:00:00Z",
        host: "Théo",
        hostAvatarUrl: null,
        objectRequest: "Aide setup CRM client",
        rescheduleUrl: "https://tidycal.com/reschedule",
      }}
    />
  </div>
);

export const Disabled = () => (
  <div style={{ width: 760 }}>
    <CoachingHeroBanner
      title="Accompagnement Notion avancé"
      description="Tu as utilisé tous tes appels cette semaine. Reviens dimanche pour réserver de nouvelles sessions avec ton coach."
      accroche="Ta limite hebdomadaire est atteinte"
      button={{
        label: "Calendrier indisponible",
        disabled: true,
        disabledTooltip:
          "Tu pourras réserver de nouveaux appels à partir de dimanche.",
      }}
    />
  </div>
);
