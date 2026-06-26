"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

// = --reveal-dur de .nc-skel-reveal (cf. globals.css). Durée du cross-fade avant
// de démonter le skeleton.
const REVEAL_MS = 400;

// Révélation skeleton → contenu (transitions.dev 14-skeleton-reveal).
// Le skeleton et le contenu sont empilés et se croisent en fondu + flou quand
// les données arrivent (même animation que l'avatar des coachings passés et que
// l'éditeur de profil). Le contenu n'est monté qu'une fois chargé ; le skeleton
// reste le temps du cross-fade puis est retiré (il portait la hauteur pendant
// le chargement → pas de saut de layout).
export function SkeletonReveal({
  loading,
  skeleton,
  children,
  contentStyle,
}: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  // Le wrapper du contenu n'impose aucune mise en page : si le contenu a besoin
  // d'un flex/gap propre (ex. bulles de messages), le passer ici.
  contentStyle?: CSSProperties;
}) {
  const [revealed, setRevealed] = useState(() => !loading);
  const [showSkel, setShowSkel] = useState(() => loading);

  useEffect(() => {
    // setState déféré (rAF/timeout) — règle react-hooks/set-state-in-effect du
    // repo, et le rAF est de toute façon nécessaire pour amorcer le cross-fade
    // (contenu monté à opacity 0 + flou, révélé au frame suivant).
    if (loading) {
      const raf = requestAnimationFrame(() => {
        setRevealed(false);
        setShowSkel(true);
      });
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setRevealed(true));
    const timer = setTimeout(() => setShowSkel(false), REVEAL_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [loading]);

  return (
    <div
      className="nc-skel-reveal"
      data-has-content={loading ? "false" : "true"}
      data-revealed={revealed ? "true" : "false"}
    >
      {!loading && (
        <div className="nc-skel-reveal__content" style={contentStyle}>
          {children}
        </div>
      )}
      {showSkel && <div className="nc-skel-reveal__skel">{skeleton}</div>}
    </div>
  );
}
