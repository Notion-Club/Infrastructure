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
}

export function GradualBlurOverlay({
  height = 120,
  zIndex = 30,
}: GradualBlurOverlayProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height,
        pointerEvents: "none",
        zIndex,
      }}
    >
      {LAYERS.map((l, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: `blur(${l.blur}px)`,
            WebkitBackdropFilter: `blur(${l.blur}px)`,
            maskImage: `linear-gradient(to bottom, transparent ${l.from}%, black ${l.to}%, black 100%)`,
            WebkitMaskImage: `linear-gradient(to bottom, transparent ${l.from}%, black ${l.to}%, black 100%)`,
          }}
        />
      ))}
    </div>
  );
}
