import { SettingsCard } from "./SettingsCard";
import { IntegrationCard } from "./SecuritySection";

// Section « Intégrations » — connexions tierces (Notion à venir). Distincte de
// la connexion Google (qui est une méthode d'authentification, rangée dans la
// section Sécurité). Titre de même niveau que les autres sections (SettingsCard).
const NOTION_LOGO_SRC =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1776790487/Logo_Notion_fgou5g.png";

export function IntegrationsSection({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  return (
    <SettingsCard
      title="Intégrations"
      icon="/icons-notion/looped-square_lightgray.svg"
      description="Connecte tes outils au Notion Club."
      fbLabel="Section intégrations · Réglages"
      embedded={embedded}
    >
      <IntegrationCard
        logo={
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={NOTION_LOGO_SRC}
            alt="Notion"
            width={20}
            height={20}
            style={{ display: "block", borderRadius: 4 }}
          />
        }
        title="Connexion avec Notion"
        action={
          <span
            className="nc-btn-shine"
            aria-disabled="true"
            data-fb-label="Badge Notion à venir · Section intégrations"
            style={{
              padding: "8px 14px",
              borderRadius: 9999,
              background: "var(--color-brand)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "default",
              userSelect: "none",
            }}
          >
            Prochaine fonctionnalité
          </span>
        }
      />
    </SettingsCard>
  );
}
