import type { ReactNode } from "react";

type SettingsCardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "danger";
  fbLabel?: string;
  /** Chemin d'une icône (ex. "/icons-notion/card_lightgray.svg") affichée à
   *  gauche du titre de section. Rendue via mask → recolorée sur la couleur du
   *  titre (texte par défaut, brand en zone de danger). */
  icon?: string;
  /** Icône lucide (ReactNode) — alternative à `icon`. Recolorée sur la couleur
   *  du titre via `currentColor`. Prioritaire sur `icon` si les deux sont
   *  fournis. */
  iconNode?: ReactNode;
  /** Quand true, ne rend PAS le cadre (bordure/fond/ombre) : juste l'en-tête +
   *  le contenu, pour être imbriqué dans un cadre parent (ex. fusion de deux
   *  sections sous un seul encadré). */
  embedded?: boolean;
};

export function SettingsCard({
  title,
  description,
  children,
  tone = "default",
  fbLabel,
  icon,
  iconNode,
  embedded = false,
}: SettingsCardProps) {
  const isDanger = tone === "danger";
  const titleColor = isDanger
    ? "var(--color-brand)"
    : "var(--color-text-primary)";

  const header = title ? (
    <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {iconNode ? (
          // Icône lucide : recolorée sur la couleur du titre via currentColor.
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              color: titleColor,
            }}
          >
            {iconNode}
          </span>
        ) : icon ? (
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              flexShrink: 0,
              display: "block",
              // Recoloration de l'icône sur la couleur du titre via mask.
              backgroundColor: titleColor,
              WebkitMaskImage: `url(${icon})`,
              maskImage: `url(${icon})`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
            }}
          />
        ) : null}
        <h2
          data-fb-label="Titre section · Réglages"
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: titleColor,
          }}
        >
          {title}
        </h2>
      </div>
      {description && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-muted)",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
    </header>
  ) : null;

  // Mode imbriqué : pas de chrome de carte, juste header + contenu.
  if (embedded) {
    return (
      <div
        data-fb-label={fbLabel ?? "Section réglages · Réglages"}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        {header}
        {children}
      </div>
    );
  }

  return (
    <section
      data-fb-label={fbLabel ?? "Section réglages · Réglages"}
      style={{
        background: "var(--color-surface-card)",
        border: isDanger
          ? "1px solid rgba(224,98,90,0.35)"
          : "1px solid var(--color-border-default)",
        borderRadius: 20,
        padding: 24,
        boxShadow: "var(--nc-shadow-3)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {header}
      {children}
    </section>
  );
}

export function SettingsDivider() {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        background: "var(--color-border-default)",
        margin: "4px 0",
      }}
    />
  );
}
