// Descripteurs des splash screens iOS (apple-touch-startup-image).
//
// iOS, en PWA standalone, n'affiche un launch screen QUE si une image
// `apple-touch-startup-image` matche EXACTEMENT la résolution physique du
// device (largeur logique × dpr) ET la media query. Sinon : écran blanc.
//
// STRATÉGIE light/dark : iOS ne bascule PAS de façon fiable le splash selon le
// thème (prefers-color-scheme ignoré / figé au cache d'installation). On fournit
// donc UNE SEULE image par device (couleur unique #f5f2f2, cf. generator), SANS
// `prefers-color-scheme`. La bascule vers le bon thème est faite côté web : le
// squelette est rendu dans le bon thème et le voile `.nc-splash-cover` (même
// couleur) se fond par-dessus → transition fluide vers light OU dark.
//
// Cette liste DOIT rester synchronisée avec le tableau DEVICES de
// `scripts/generate-ios-splash.mjs`.

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

export const IOS_SPLASH_LINKS: IosSplashLink[] = DEVICES.map(([lw, lh, dpr]) => ({
  media: `(device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
  href: `/splash/apple-splash-${lw * dpr}-${lh * dpr}.png`,
}));
