// Descripteurs des splash screens iOS (apple-touch-startup-image).
//
// iOS, en PWA standalone, n'affiche un launch screen QUE si une image
// `apple-touch-startup-image` matche EXACTEMENT la résolution physique du
// device (largeur logique × dpr) ET la media query. Sinon : écran blanc
// pendant tout le boot + chargement réseau.
//
// Les PNG sont générés par `scripts/generate-ios-splash.mjs` (fond de marque
// + logo centré). Cette liste DOIT rester synchronisée avec le tableau
// DEVICES de ce script. Light + dark sont fournis et sélectionnés par iOS via
// `prefers-color-scheme` (le seul signal de thème disponible avant l'exécution
// du JS — la préférence next-themes en localStorage n'est pas encore lue).

// [largeur logique, hauteur logique, dpr]
const DEVICES: ReadonlyArray<readonly [number, number, number]> = [
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [414, 896, 2],
  [414, 896, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
];

export interface IosSplashLink {
  media: string;
  href: string;
}

export const IOS_SPLASH_LINKS: IosSplashLink[] = (
  ["light", "dark"] as const
).flatMap((scheme) =>
  DEVICES.map(([lw, lh, dpr]) => {
    const pxW = lw * dpr;
    const pxH = lh * dpr;
    return {
      media: `(prefers-color-scheme: ${scheme}) and (device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
      href: `/splash/apple-splash-${scheme}-${pxW}-${pxH}.png`,
    };
  }),
);
