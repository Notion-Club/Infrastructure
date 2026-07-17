const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

// Skeleton de chargement de /communaute (feed + messages).
//
// ⚠️ Ce skeleton CALQUE À L'IDENTIQUE la structure du vrai shell rendu par le
// layout (cf. (shell)/layout.tsx + CommunityPage) : MÊME wrapper
// `nc-page-halo nc-community-shell`, MÊME `<main>` (mêmes classes de padding /
// maxWidth), MÊME carte `nc-community-card nc-community-card--fixed` en `flex-1`
// qui REMPLIT le viewport, MÊME en-tête de switcher avec son `borderBottom`,
// MÊME zone de liste scrollable interne. C'est volontaire et NÉCESSAIRE : comme
// le wrapper et la carte sont pilotés par les MÊMES classes que le réel, la
// position (offset haut via `.nc-community-shell > main`, hauteur de carte via
// `--fixed`, safe-area via `.nc-page-halo`) est PIXEL-IDENTIQUE. Sans ça, le
// skeleton apparaissait plus bas que sa cible puis « sautait » au swap.
//
// Note : on utilise bien `.nc-page-halo` — l'ancienne raison de l'éviter (un 2ᵉ
// dégradé radial `::before`) est obsolète : le fond de marque vit désormais dans
// `.nc-app-bg` (root layout) et `.nc-page-halo` est transparent (cf. globals.css).
export default function CommunauteLoading() {
  return (
    <div className="nc-page-halo nc-community-shell flex flex-col">
      <main
        className="flex flex-col flex-1 w-full mx-auto px-4 md:px-10 md:pt-[104px] md:pb-8"
        style={{ position: "relative", zIndex: 1, maxWidth: 1000 }}
      >
        {/* Carte globale — MÊMES classes que le conteneur de CommunityPage :
            `--fixed` fixe la hauteur (remplit le viewport en mobile via flex-1,
            `calc(100dvh - 136px)` en desktop) → le cadre du skeleton occupe
            exactement la place du cadre réel. */}
        <div
          className="flex flex-col flex-1 nc-community-card nc-community-card--fixed"
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 20,
            boxShadow: "var(--nc-shadow-3)",
            overflow: "hidden",
          }}
        >
          {/* En-tête switcher (Feed | Messages) — MÊME borderBottom que le réel */}
          <div
            className="shrink-0"
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--color-border-default)",
              background: "var(--color-surface-card)",
            }}
          >
            <div
              style={{
                display: "flex",
                background: "var(--color-surface-raised)",
                borderRadius: 10,
                padding: 3,
                gap: 2,
              }}
            >
              {/* Placeholders blancs (surface-card) : visibles sur le conteneur
                  segmenté surface-raised, comme l'onglet actif réel. */}
              <div style={{ ...pulse, background: "var(--color-surface-card)", flex: 1, height: 34, borderRadius: 8 }} />
              <div style={{ ...pulse, background: "var(--color-surface-card)", flex: 1, height: 34, borderRadius: 8, animationDelay: "60ms" }} />
            </div>
          </div>

          {/* Filtres de tags + bouton « Nouveau post » (desktop) */}
          <div
            className="shrink-0"
            style={{
              padding: "16px 16px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              {/* Chips blancs (surface-card) : visibles sur le fond surface-raised
                  de la carte, comme les vrais filtres de tags. */}
              {[0, 60, 120].map((delay) => (
                <div
                  key={delay}
                  style={{ ...pulse, background: "var(--color-surface-card)", height: 32, width: 90, borderRadius: 9999, animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <div
              className="hidden md:block"
              style={{ ...pulse, background: "var(--color-surface-card)", height: 34, width: 130, borderRadius: 9999 }}
            />
          </div>

          {/* Liste de posts — zone à scroll interne (flex-1 + min-h-0), MÊME
              padding que `.nc-feed-scroll` du réel. */}
          <div
            className="flex-1 overflow-hidden"
            style={{ minHeight: 0, padding: "0 16px 16px" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 16,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {/* Avatar + auteur + date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ ...pulse, width: 36, height: 36, borderRadius: "50%", flexShrink: 0, animationDelay: `${i * 60}ms` }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                      <div style={{ ...pulse, height: 13, width: "35%", animationDelay: `${i * 60 + 30}ms` }} />
                      <div style={{ ...pulse, height: 11, width: "20%", animationDelay: `${i * 60 + 50}ms` }} />
                    </div>
                    <div style={{ ...pulse, height: 22, width: 64, borderRadius: 9999, animationDelay: `${i * 60 + 40}ms` }} />
                  </div>
                  {/* Corps du post */}
                  <div style={{ ...pulse, height: 14, width: "90%", animationDelay: `${i * 60 + 60}ms` }} />
                  <div style={{ ...pulse, height: 14, width: "70%", animationDelay: `${i * 60 + 80}ms` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
