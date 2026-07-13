"use client";

// Bulles factices pulsantes affichées pendant le chargement des messages
// d'une conversation. Pattern Slack/WhatsApp : 4 bulles alternées gauche/
// droite, taille variable pour une impression de variété. Animation pulse
// via Tailwind animate-pulse + background var(--color-surface-raised).
//
// On évite un spinner centré car visuellement on perd l'identité du chat :
// les bulles donnent un indice clair que "des messages vont arriver".
const SKELETON_SHAPES: Array<{ isSelf: boolean; width: number }> = [
  { isSelf: false, width: 180 },
  { isSelf: true, width: 140 },
  { isSelf: false, width: 220 },
  { isSelf: true, width: 100 },
  { isSelf: false, width: 160 },
];

export function MessageBubbleSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px",
      }}
    >
      {SKELETON_SHAPES.map((shape, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: shape.isSelf ? "flex-end" : "flex-start",
          }}
        >
          <div
            className="animate-pulse"
            style={{
              width: shape.width,
              height: 36,
              // Sorties = bulle iMessage compacte (cf. .nc-imsg-bubble), reçues = style existant.
              borderRadius: shape.isSelf ? 18 : "16px 16px 16px 4px",
              background: "var(--color-surface-raised)",
              border: shape.isSelf ? "none" : "1px solid var(--color-border-default)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
