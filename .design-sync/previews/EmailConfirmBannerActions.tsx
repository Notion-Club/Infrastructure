import { EmailConfirmBannerActions } from "notionclub-infra";

// The actions row as it sits inside the shine-card banner: a Gmail shortcut
// (when the address looks Google-hosted) + a "renvoyer l'email" button.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    className="nc-shine-card"
    style={{ width: 560 }}
    data-fb-label="Bannière Confirmation email · Tableau de bord"
  >
    <div className="nc-shine-card__inner" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          Confirme ton adresse email
        </span>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Tu as reçu un email pour valider ton compte.{" "}
          <span style={{ color: "var(--color-text-muted)" }}>Pas reçu ?</span>
        </p>
        {children}
      </div>
    </div>
  </div>
);

export const Default = () => (
  <Frame>
    <EmailConfirmBannerActions showGmail={false} />
  </Frame>
);

export const AvecGmail = () => (
  <Frame>
    <EmailConfirmBannerActions showGmail />
  </Frame>
);
