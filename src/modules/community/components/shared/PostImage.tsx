"use client";

import { useState } from "react";

// Média d'un post (feed) — image affichée EN ENTIER (pas de crop) + anti-pop-in.
//
// Historique :
//   - avant #263 : <img loading="lazy"> sans place réservée → l'image arrivait
//     après le texte et poussait le layout (« saccade »).
//   - #263 : boîte à ratio FIXE (16/10) + object-fit cover → plus de saccade mais
//     les images étaient ROGNÉES (16:9, 4:3, 3:2… coupées).
//
// Ici on garde l'anti-pop-in SANS rogner : la boîte réserve d'abord une place au
// ratio 16/9 (skeleton), puis, au décodage, on adopte le ratio NATUREL de l'image
// (borné pour ne pas casser la mise en page). Comme la boîte épouse alors le ratio
// de l'image, object-fit: cover la montre en intégralité — les formats paysage
// visés (16:9, 5:4, 7:5, 4:3, 5:3, 3:2 → ratio 1.25…1.78) sont tous dans les
// bornes, donc jamais rognés. Reveal en fondu (transitions.dev · 14).
interface PostImageProps {
  src: string;
  alt?: string;
  onOpen?: () => void;
  // Largeur max de la preview (feed = 380). Jamais plus large que la carte.
  maxWidth?: number;
  fbLabel?: string;
}

// Ratio (largeur/hauteur) de la place réservée AVANT décodage (skeleton).
const LOADING_RATIO = 16 / 9;
// Bornes du ratio naturel : au-delà (image ultra-haute ou ultra-large) on borne
// pour ne pas déséquilibrer le feed. Tous les formats paysage visés (1.25→1.78)
// sont à l'intérieur → affichés en entier.
const MIN_RATIO = 0.6; // plus haut que ça (portrait) → borné
const MAX_RATIO = 2.4; // plus large que ça (panorama) → borné
// Garde-fou hauteur (portraits) : au-delà, la boîte plafonne et l'image est
// recadrée. Aucun format paysage listé ne l'atteint à la largeur du feed.
const MAX_HEIGHT = 460;

export function PostImage({ src, alt = "", onOpen, maxWidth = 380, fbLabel }: PostImageProps) {
  const [loaded, setLoaded] = useState(false);
  // null tant que l'image n'est pas décodée → on affiche LOADING_RATIO.
  const [ratio, setRatio] = useState<number | null>(null);

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const r = img.naturalWidth / img.naturalHeight;
      setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, r)));
    }
    setLoaded(true);
  }

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
        aspectRatio: String(ratio ?? LOADING_RATIO),
        maxHeight: MAX_HEIGHT,
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
        onLoad={handleLoad}
        onError={() => setLoaded(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          // La boîte épouse le ratio naturel → cover = image entière (pas de
          // rognage) pour les formats dans les bornes ; ne recadre que les
          // portraits bornés par MAX_HEIGHT.
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          filter: loaded ? "blur(0)" : "blur(6px)",
          transition: "opacity 400ms var(--nc-ease), filter 400ms var(--nc-ease)",
        }}
      />
    </button>
  );
}
