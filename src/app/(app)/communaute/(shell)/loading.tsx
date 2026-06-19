const pulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

// Aligné sur communaute/layout.tsx : maxWidth 1000, padding px-4 pt-[64px]
// pb-[100px] md:px-10 md:pt-[88px] md:pb-6 (mêmes valeurs que le <main> du
// layout, sinon saut skeleton→contenu). Ne s'affiche plus qu'au PREMIER
// chargement de /communaute (le layout étant ensuite préservé, les
// navigations internes feed↔messages ne redéclenchent plus ce fallback).
//
// ⚠️ PAS de `.nc-page-halo` ici : le layout fournit déjà le halo (fond +
// ::before en dégradé radial `position: fixed`). Un second halo empilait un
// 2ᵉ dégradé fixe plein écran pendant le swap loading→contenu → bande de
// saturation + couture verticale visibles en haut de page. On garde juste le
// fond opaque (zéro flash blanc), sans le pseudo-élément dupliqué.
export default function CommunauteLoading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--color-surface-page)",
        // Parité avec `.nc-page-halo` (PWA standalone iOS) : sans ce padding,
        // le skeleton remonterait de ~44px sous l'heure iPhone vs le contenu.
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
        <main style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{ maxWidth: 1000, margin: "0 auto" }}
            className="px-4 pt-[64px] pb-[100px] md:px-10 md:pt-[88px] md:pb-6"
          >
            {/* Tab bar skeleton — Feed | Messages */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <div style={{ ...pulse, height: 36, width: 80, borderRadius: 9999 }} />
              <div style={{ ...pulse, height: 36, width: 100, borderRadius: 9999, animationDelay: "60ms" }} />
            </div>

            {/* Tag filter pills skeleton */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {[0, 60, 120, 180, 240].map((delay) => (
                <div
                  key={delay}
                  style={{ ...pulse, height: 30, width: 80 + delay * 0.2, borderRadius: 9999, animationDelay: `${delay}ms` }}
                />
              ))}
            </div>

            {/* Post cards skeleton */}
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
                    animationDelay: `${i * 60}ms`,
                  }}
                >
                  {/* Avatar + author + date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ ...pulse, width: 36, height: 36, borderRadius: "50%", flexShrink: 0, animationDelay: `${i * 60}ms` }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                      <div style={{ ...pulse, height: 13, width: "35%", animationDelay: `${i * 60 + 30}ms` }} />
                      <div style={{ ...pulse, height: 11, width: "20%", animationDelay: `${i * 60 + 50}ms` }} />
                    </div>
                    <div style={{ ...pulse, height: 22, width: 64, borderRadius: 9999, animationDelay: `${i * 60 + 40}ms` }} />
                  </div>
                  {/* Post body */}
                  <div style={{ ...pulse, height: 14, width: "90%", animationDelay: `${i * 60 + 60}ms` }} />
                  <div style={{ ...pulse, height: 14, width: "70%", animationDelay: `${i * 60 + 80}ms` }} />
                </div>
              ))}
            </div>
          </div>
        </main>
    </div>
  );
}
