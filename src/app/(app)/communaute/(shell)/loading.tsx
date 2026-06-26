const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

// Skeleton de chargement de /communaute (feed + messages).
//
// ⚠️ Ce skeleton CALQUE À L'IDENTIQUE la structure rendue par CommunityPage
// (cf. community-page.tsx) : MÊME wrapper (flex/h-dvh/overflow-hidden), MÊME
// grosse carte `surface-raised` arrondie, MÊME en-tête de switcher avec son
// `borderBottom`, MÊME liste interne scrollable. C'est volontaire : le swap
// skeleton → contenu devient PIXEL-ALIGNÉ.
//   - Avant : le skeleton était une liste lâche (pills + cartes sans
//     conteneur). Au chargement, la vraie carte apparaissait avec son
//     `borderBottom` de switcher + ses bords → une « ligne » horizontale
//     surgissait et la mise en page sautait en deux temps.
//   - Maintenant : la carte (et son `borderBottom`) sont déjà présents dans le
//     skeleton → rien n'« apparaît », aucune couture, aucun saut.
//
// Padding / maxWidth alignés sur le <main> du layout (px-4 pt-[64px] pb-[calc(env(safe-area-inset-bottom,0px)+86px)]
// md:px-10 md:pt-[104px] md:pb-8, maxWidth 1000). PAS de `.nc-page-halo` : le
// fond opaque `surface-page` suffit et évite d'empiler un 2ᵉ dégradé radial
// fixe pendant le swap (sinon bande de saturation, cf. fix précédent).
export default function CommunauteLoading() {
  return (
    <div
      className="flex flex-col h-dvh overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface-page)",
        // Parité avec `.nc-page-halo` (PWA standalone iOS) : sans ce padding,
        // le skeleton remonterait de ~44px sous l'heure iPhone vs le contenu.
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <main
        className="flex flex-col flex-1 min-h-0 w-full mx-auto px-4 pt-[64px] pb-[calc(env(safe-area-inset-bottom,0px)+86px)] md:px-10 md:pt-[104px] md:pb-8"
        style={{ position: "relative", zIndex: 1, maxWidth: 1000 }}
      >
        {/* Carte globale — calque le conteneur de CommunityPage */}
        <div
          className="flex flex-col flex-1 min-h-0"
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

          {/* Liste de posts — zone scrollable interne (overflow-y uniquement) */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            style={{ padding: "0 16px 16px" }}
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
