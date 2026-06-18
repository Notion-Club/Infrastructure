// Skeleton de la page Réglages — réplique le gabarit réel (ProfileRecapCard +
// cartes de section) pour que le chargement soit en accord avec les composants
// affichés ensuite, sans molette de chargement ni skeleton générique décalé.
//
// Pur markup (utilisable côté serveur dans settings/loading.tsx ET côté client
// dans SettingsClient). L'animation réutilise le keyframe `nc-skeleton-pulse`.

const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

function Bar({
  w = "100%",
  h,
  r,
  delay,
}: {
  w?: number | string;
  h: number;
  r?: number | string;
  delay?: number;
}) {
  return (
    <div
      style={{
        ...pulse,
        width: w,
        height: h,
        ...(r !== undefined ? { borderRadius: r } : {}),
        ...(delay ? { animationDelay: `${delay}ms` } : {}),
      }}
    />
  );
}

// Carte de section : même gabarit qu'une SettingsCard (surface-card, bordure,
// radius 20, padding 24) avec un en-tête (icône + titre) et des lignes.
function SkelCard({
  rows = 2,
  delay = 0,
}: {
  rows?: number;
  delay?: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 20,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* En-tête : pastille icône + titre + sous-titre */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Bar w={22} h={22} r={6} delay={delay} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <Bar w="38%" h={16} r={6} delay={delay} />
          <Bar w="62%" h={11} r={6} delay={delay} />
        </div>
      </div>
      {/* Lignes de contenu (champs) */}
      {Array.from({ length: rows }).map((_, i) => (
        <Bar key={i} h={46} r={12} delay={delay + i * 60} />
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ProfileRecapCard (compacte) */}
      <div
        aria-hidden
        style={{
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 20,
          padding: 20,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Bar w={52} h={52} r="50%" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <Bar w="40%" h={15} r={6} />
          <Bar w="55%" h={11} r={6} />
        </div>
        <Bar w={20} h={20} r={6} />
      </div>

      {/* Sections : Mes informations, Sécurité, Facturation, Notifications */}
      <SkelCard rows={2} delay={40} />
      <SkelCard rows={2} delay={80} />
      <SkelCard rows={3} delay={120} />
      <SkelCard rows={3} delay={160} />
    </div>
  );
}
