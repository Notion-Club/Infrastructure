const LAYERS = [
  { blur: 2, from: 0, to: 20 },
  { blur: 5, from: 15, to: 40 },
  { blur: 10, from: 30, to: 60 },
  { blur: 18, from: 45, to: 80 },
  { blur: 28, from: 60, to: 95 },
  { blur: 45, from: 75, to: 100 },
];

interface GradualBlurOverlayProps {
  height?: number;
  zIndex?: number;
  /**
   * - 'fixed' (défaut) : voile collé en bas du viewport, suit le scroll de window.
   * - 'sticky' : voile localisé au scroll d'un conteneur parent (qui doit être
   *   en position: relative + overflow-y: auto). Placer ce composant en dernier
   *   enfant du conteneur scrollable.
   * - 'absolute' : voile épinglé sur un bord (cf. `edge`) d'un conteneur parent
   *   en position: relative. Utile pour flouter le haut/bas d'une zone
   *   scrollable (ex. corps d'une modale).
   */
  position?: "fixed" | "sticky" | "absolute";
  /**
   * Bord depuis lequel le flou est le plus fort. 'bottom' (défaut) pour le bas,
   * 'top' pour le haut. Ignoré en position 'fixed'/'sticky' (toujours en bas).
   */
  edge?: "top" | "bottom";
}

export function GradualBlurOverlay({
  height = 120,
  zIndex = 30,
  position = "fixed",
  edge = "bottom",
}: GradualBlurOverlayProps) {
  // Direction du dégradé : le flou plein (`black`) est appliqué côté `edge`.
  const dir = edge === "top" ? "to top" : "to bottom";

  let containerStyle: React.CSSProperties;
  if (position === "sticky") {
    containerStyle = {
      position: "sticky",
      bottom: 0,
      height,
      marginTop: -height,
      pointerEvents: "none",
      zIndex,
    };
  } else if (position === "absolute") {
    containerStyle = {
      position: "absolute",
      left: 0,
      right: 0,
      [edge]: 0,
      height,
      pointerEvents: "none",
      zIndex,
    };
  } else {
    containerStyle = {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      height,
      pointerEvents: "none",
      zIndex,
    };
  }

  return (
    <div aria-hidden style={containerStyle}>
      {LAYERS.map((l, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: `blur(${l.blur}px)`,
            WebkitBackdropFilter: `blur(${l.blur}px)`,
            maskImage: `linear-gradient(${dir}, transparent ${l.from}%, black ${l.to}%, black 100%)`,
            WebkitMaskImage: `linear-gradient(${dir}, transparent ${l.from}%, black ${l.to}%, black 100%)`,
          }}
        />
      ))}
    </div>
  );
}
