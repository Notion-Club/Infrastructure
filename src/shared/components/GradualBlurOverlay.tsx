// Flou progressif LÉGER : 3 calques au lieu de 6 (chaque calque `backdrop-filter`
// est coûteux sur mobile). Suffit à adoucir la coupure sans alourdir le rendu.
const LAYERS = [
  { blur: 2, from: 0, to: 35 },
  { blur: 6, from: 25, to: 70 },
  { blur: 12, from: 55, to: 100 },
];

interface GradualBlurOverlayProps {
  height?: number;
  zIndex?: number;
  /**
   * - 'fixed' (défaut) : voile collé au viewport, suit le scroll de window.
   * - 'sticky' : voile localisé au scroll d'un conteneur parent (qui doit être
   *   en position: relative + overflow-y: auto). Placer ce composant en dernier
   *   enfant du conteneur scrollable.
   */
  position?: "fixed" | "sticky";
  /**
   * Côté du voile.
   * - 'bottom' (défaut) : flou max au bas du voile, fondu vers le haut.
   *   Pour cacher le contenu qui passe sous la BottomNav mobile.
   * - 'top' : flou max au haut du voile, fondu vers le bas. Pour la
   *   zone status bar iOS en PWA standalone (la page extend derrière
   *   `env(safe-area-inset-top)`, on lui ajoute un frosted glass).
   */
  anchor?: "top" | "bottom";
}

export function GradualBlurOverlay({
  height = 120,
  zIndex = 30,
  position = "fixed",
  anchor = "bottom",
}: GradualBlurOverlayProps) {
  const isSticky = position === "sticky";
  const isTop = anchor === "top";

  const containerStyle: React.CSSProperties = isSticky
    ? {
        position: "sticky",
        [isTop ? "top" : "bottom"]: 0,
        height,
        ...(isTop ? { marginBottom: -height } : { marginTop: -height }),
        pointerEvents: "none",
        zIndex,
      }
    : {
        position: "fixed",
        left: 0,
        right: 0,
        [isTop ? "top" : "bottom"]: 0,
        height,
        pointerEvents: "none",
        zIndex,
      };

  return (
    <div aria-hidden style={containerStyle}>
      {LAYERS.map((l, i) => {
        // Pour l'ancre top, on inverse le mask : `black` côté haut du
        // voile (flou max), `transparent` côté bas (zéro effet sur le
        // contenu de la page).
        const maskImage = isTop
          ? `linear-gradient(to bottom, black 0%, black ${100 - l.to}%, transparent ${100 - l.from}%)`
          : `linear-gradient(to bottom, transparent ${l.from}%, black ${l.to}%, black 100%)`;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              backdropFilter: `blur(${l.blur}px)`,
              WebkitBackdropFilter: `blur(${l.blur}px)`,
              maskImage,
              WebkitMaskImage: maskImage,
            }}
          />
        );
      })}
    </div>
  );
}

