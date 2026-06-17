import { ProfileEditor } from "notionclub-infra";

// ProfileEditor charge son profil depuis Supabase à l'ouverture ; hors runtime
// l'appel échoue et il bascule sur MOCK_PROFILE (Théo). Il est prévu pour vivre
// dans une modale en flex-column pleine hauteur — on lui donne ce cadre.
const frame = (children: React.ReactNode) => (
  <div
    style={{
      width: 560,
      height: 640,
      display: "flex",
      flexDirection: "column",
      background: "var(--color-surface-card)",
      border: "1px solid var(--color-border-default)",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "var(--nc-shadow-2)",
    }}
  >
    {children}
  </div>
);

export const Editing = () => frame(<ProfileEditor onClose={() => {}} />);
