import type { CSSProperties } from "react";

// Squelette de chargement qui REPRODUIT la homepage (dashboard) — au lieu d'un
// spinner sur page vide. Objectif : transition loading → page sans saut, et
// fond exactement à la couleur in-app (var(--color-surface-page), dark-aware
// via la classe `.dark` posée avant le 1er paint par le script inline du root
// layout).
//
// Server Component pur (zéro hook) : utilisable dans tous les loading.tsx.
//
// `withChrome` :
//   • true  → loading racine (le layout (app) n'a pas encore rendu la Topbar /
//             BottomNav) : on dessine aussi un squelette de chrome.
//   • false → loading de page (le chrome réel est déjà monté par le layout) :
//             on ne squelette que le contenu.

const pulse: CSSProperties = {
  background: "var(--color-surface-raised)",
  animation: "nc-skeleton-pulse 1.4s var(--nc-ease) infinite",
  borderRadius: "var(--nc-radius-xs)",
};

function block(extra: CSSProperties): CSSProperties {
  return { ...pulse, ...extra };
}

// Carte widget — calquée sur FormationWidget / ProfilWidget (surface-card,
// bordure, radius 16, padding 20, shadow-3) avec ses blocs internes : label,
// titre, sous-titre, barre de progression, ligne, bouton pill.
export function WidgetCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "var(--nc-shadow-3)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minHeight: 200,
      }}
    >
      <div style={block({ height: 11, width: 120, animationDelay: `${delay}ms` })} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={block({ height: 16, width: "80%", animationDelay: `${delay}ms` })} />
        <div style={block({ height: 14, width: "55%", animationDelay: `${delay + 60}ms` })} />
      </div>
      <div
        style={block({
          height: 8,
          width: "100%",
          borderRadius: 9999,
          animationDelay: `${delay + 120}ms`,
        })}
      />
      <div style={block({ height: 13, width: "45%", animationDelay: `${delay + 120}ms` })} />
      <div
        style={block({
          height: 34,
          width: 120,
          borderRadius: 9999,
          marginTop: 4,
          animationDelay: `${delay + 160}ms`,
        })}
      />
    </div>
  );
}

// ─── Chrome (uniquement pour le loading racine) ───────────────────────────
function ChromeSkeleton() {
  return (
    <>
      {/* Topbar desktop — pill centrée */}
      <div
        className="hidden md:flex"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          justifyContent: "center",
          padding: "10px 40px",
          zIndex: 50,
        }}
        aria-hidden
      >
        <div
          style={{
            width: "100%",
            maxWidth: 840,
            height: 52,
            borderRadius: 9999,
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border-default)",
            boxShadow: "var(--nc-shadow-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
          }}
        >
          <div style={block({ height: 22, width: 92 })} />
          <div style={{ display: "flex", gap: 8 }}>
            {[64, 72, 84, 72, 78].map((w, i) => (
              <div
                key={i}
                style={block({
                  height: 28,
                  width: w,
                  borderRadius: 9999,
                  animationDelay: `${i * 40}ms`,
                })}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={block({ height: 28, width: 28, borderRadius: 9999 })} />
            <div style={block({ height: 32, width: 32, borderRadius: 9999 })} />
          </div>
        </div>
      </div>

      {/* Mobile — logo top-left */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          top: "calc(12px + env(safe-area-inset-top, 0px))",
          left: 16,
          zIndex: 40,
        }}
        aria-hidden
      >
        <div style={block({ height: 36, width: 120 })} />
      </div>

      {/* Mobile — avatar top-right */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          top: "calc(12px + env(safe-area-inset-top, 0px))",
          right: 12,
          zIndex: 40,
        }}
        aria-hidden
      >
        <div style={block({ height: 38, width: 38, borderRadius: 9999 })} />
      </div>

      {/* Mobile — BottomNav pill */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          bottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
          left: 12,
          right: 12,
          height: 56,
          borderRadius: 9999,
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-border-default)",
          boxShadow: "var(--nc-shadow-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "0 18px",
          zIndex: 50,
        }}
        aria-hidden
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={block({
              height: 22,
              width: 22,
              borderRadius: 8,
              animationDelay: `${i * 40}ms`,
            })}
          />
        ))}
      </div>
    </>
  );
}

export function DashboardSkeleton({ withChrome = false }: { withChrome?: boolean }) {
  return (
    <>
      {/* Chrome rendu HORS de nc-page-halo : son `isolation: isolate` peut
          casser `position: fixed` dans certains moteurs (cf. CONVENTIONS). */}
      {withChrome && <ChromeSkeleton />}
      <div className="nc-page-halo" style={{ minHeight: "100lvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
          className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10"
        >
          {/* Greeting + search — desktop */}
          <div className="hidden md:flex flex-col gap-5">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={block({ height: 13, width: 72 })} />
              <div
                style={block({
                  height: 58,
                  width: "52%",
                  borderRadius: "var(--nc-radius-sm)",
                  animationDelay: "60ms",
                })}
              />
            </div>
            <div
              style={block({
                height: 46,
                maxWidth: 480,
                borderRadius: 9999,
                animationDelay: "100ms",
              })}
            />
          </div>

          {/* Greeting + search — mobile */}
          <div className="md:hidden flex flex-col gap-3">
            <div
              style={block({
                height: 48,
                width: "62%",
                borderRadius: "var(--nc-radius-sm)",
              })}
            />
            <div style={block({ height: 40, borderRadius: 9999, animationDelay: "60ms" })} />
          </div>

          {/* Widgets grid — calqué sur la vraie homepage : exactement deux cartes
              (Formation + Profil). PAS de placeholder pointillé en dessous : la
              vraie page n'en a aucun, le résidu créait un encadré fantôme (et,
              en pleine largeur, un faux « barreau » de nav) qui disparaissait au
              chargement → mismatch skeleton ↔ page. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <WidgetCardSkeleton />
            <WidgetCardSkeleton delay={80} />
          </div>
        </div>
        </main>
      </div>
    </>
  );
}
