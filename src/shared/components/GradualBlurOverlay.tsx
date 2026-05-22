"use client";

import { useEffect, useState } from "react";

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
  /** Distance en px avant le bas du document à partir de laquelle le voile s'efface, pour ne pas masquer le footer. */
  fadeBeforeBottom?: number;
}

export function GradualBlurOverlay({
  height = 180,
  zIndex = 30,
  fadeBeforeBottom = 350,
}: GradualBlurOverlayProps) {
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const remaining =
        document.documentElement.scrollHeight -
        (window.scrollY + window.innerHeight);
      setFaded(remaining < fadeBeforeBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [fadeBeforeBottom]);

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
        opacity: faded ? 0 : 1,
        transition: "opacity 240ms ease",
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
