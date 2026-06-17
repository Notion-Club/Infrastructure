import { FormationWidget } from "notionclub-infra";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 420, background: "var(--color-surface-page)", padding: 20 }}>
    {children}
  </div>
);

// Cas live : formation en cours avec « Reprendre où j'en étais ».
export const EnCours = () => (
  <Frame>
    <FormationWidget
      data={{
        programSlug: "devenir-consultant-notion",
        programName: "Module 6 — Bases de données avancées",
        totalCourses: 12,
        completedCourses: 5,
        percent: 58,
        resumeHref: "/formation/devenir-consultant-notion/module-6/video-3",
        nextCourseLabel: "Vidéo 3 / 5",
      }}
    />
  </Frame>
);

// Fraîchement démarrée : 0 cours complété, sous-titre « Démarre quand tu veux ».
export const Demarrage = () => (
  <Frame>
    <FormationWidget
      data={{
        programSlug: "fondamentaux-notion",
        programName: "Les fondamentaux de Notion",
        totalCourses: 8,
        completedCourses: 0,
        percent: 0,
        resumeHref: "/formation/fondamentaux-notion",
        nextCourseLabel: null,
      }}
    />
  </Frame>
);

// Presque finie : progression haute.
export const PresqueTerminee = () => (
  <Frame>
    <FormationWidget
      data={{
        programSlug: "automatisations-make",
        programName: "Automatiser son business avec Make",
        totalCourses: 10,
        completedCourses: 9,
        percent: 92,
        resumeHref: "/formation/automatisations-make/module-10/video-2",
        nextCourseLabel: "Vidéo 2 / 4",
      }}
    />
  </Frame>
);

// Fallback interne (data non fourni) — mock Storybook intégré.
export const Fallback = () => (
  <Frame>
    <FormationWidget />
  </Frame>
);
