// Descripteurs des splash screens iOS (apple-touch-startup-image).
//
// iOS, en PWA standalone, n'affiche un launch screen QUE si une image
// `apple-touch-startup-image` matche EXACTEMENT la résolution physique du
// device (largeur logique × dpr) ET la media query. Sinon : écran blanc
// pendant tout le boot + chargement réseau.
//
// SÉLECTION LIGHT / DARK — format éprouvé (cf. pwa-asset-generator) :
//   • Image CLAIRE (défaut) : media SANS `prefers-color-scheme` → matche dès que
//     les dimensions correspondent.
//   • Image SOMBRE : media identique + `and (prefers-color-scheme: dark)`,
//     émise APRÈS la claire.
// En dark mode, les DEUX matchent les dimensions ; iOS retient la dernière
// déclarée qui matche → la sombre. En light mode, seule la claire matche.
// (Un couple light/dark mutuellement exclusif via `prefers-color-scheme: light`
// n'est PAS fiable sur iOS : il retombe sur la 1ʳᵉ image aux bonnes dimensions,
// donc toujours la claire — c'était le bug.)
//
// Les PNG sont générés par `scripts/generate-ios-splash.mjs`. Cette liste DOIT
// rester synchronisée avec le tableau DEVICES de ce script.

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

function dims(lw: number, lh: number, dpr: number): string {
  return `(device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`;
}

// Ordre important : claires (défaut) d'abord, sombres ensuite — iOS retient la
// dernière media query qui matche.
export const IOS_SPLASH_LINKS: IosSplashLink[] = [
  ...DEVICES.map(([lw, lh, dpr]) => ({
    media: dims(lw, lh, dpr),
    href: `/splash/apple-splash-light-${lw * dpr}-${lh * dpr}.png`,
  })),
  ...DEVICES.map(([lw, lh, dpr]) => ({
    media: `${dims(lw, lh, dpr)} and (prefers-color-scheme: dark)`,
    href: `/splash/apple-splash-dark-${lw * dpr}-${lh * dpr}.png`,
  })),
];
