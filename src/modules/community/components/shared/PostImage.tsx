"use client";

import { useState } from "react";

// Média d'un post (feed) — anti-« pop-in saccadé ».
//
// Problème résolu : l'ancienne <img loading="lazy"> sans dimensions réservées
// arrivait quelques secondes après le texte et poussait le layout (le corps de
// la carte « sautait » quand la hauteur de l'image se résolvait). Résultat : le
// titre/texte/réactions s'affichaient d'abord, le média ensuite, en saccade.
//
// Solution (transitions.dev · 14-skeleton-reveal, tokens .nc-skeleton) :
//   1. la boîte média réserve sa place DÈS le 1er paint via un aspect-ratio
//      fixe → zéro décalage de layout, la carte est complète immédiatement ;
//   2. un placeholder gris pulsant (.nc-skeleton) occupe cette boîte tant que
//      l'image n'est pas décodée ;
//   3. au décodage (onLoad), l'image se révèle en fondu (opacity + micro-flou)
//      par-dessus le placeholder → apparition douce, « en même temps » que le
//      reste de la carte, jamais en à-coups.
//
// La carte du feed montre une preview cadrée (object-fit: cover) ; le clic ouvre
// la lightbox plein écran (image entière), cohérent avec le pattern existant.
interface PostImageProps {
  src: string;
  alt?: string;
  onOpen?: () => void;
  // Largeur max de la preview (feed = 380). Jamais plus large que la carte.
  maxWidth?: number;
  // Ratio de la boîte réservée (largeur / hauteur). 16/10 = paysage doux.
  ratio?: number;
  fbLabel?: string;
}

export function PostImage({
  src,
  alt = "",
  onOpen,
  maxWidth = 380,
  ratio = 16 / 10,
  fbLabel,
}: PostImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      data-fb-label={fbLabel}
      style={{
        position: "relative",
        padding: 0,
        border: "1px solid var(--color-border-default)",
        background: "var(--color-surface-raised)",
        cursor: "zoom-in",
        marginTop: 4,
        display: "block",
        width: `min(${maxWidth}px, 100%)`,
        aspectRatio: String(ratio),
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Placeholder pulsant — retiré du flux visuel une fois l'image révélée. */}
      <span
        aria-hidden="true"
        className={loaded ? undefined : "nc-skeleton"}
        style={{
          position: "absolute",
          inset: 0,
          opacity: loaded ? 0 : 1,
          transition: "opacity 400ms var(--nc-ease)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          filter: loaded ? "blur(0)" : "blur(6px)",
          transition: "opacity 400ms var(--nc-ease), filter 400ms var(--nc-ease)",
        }}
      />
    </button>
  );
}
