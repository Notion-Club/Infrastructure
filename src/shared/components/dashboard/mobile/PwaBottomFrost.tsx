import { GradualBlurOverlay } from "@/shared/components/GradualBlurOverlay";

// Frost du BAS — PWA standalone mobile UNIQUEMENT (cf. .nc-pwa-bottom-frost dans
// globals.css : display:none par défaut, block en display-mode:standalone).
// Floute le contenu qui défile sous la BottomNav flottante.
//
// Extrait du root layout pour être rendu DANS le ViewportFrame sur /communaute
// (règle d'unicité du référentiel §2.1 : tout le chrome fixed mobile vit dans le
// frame sur cette route) et dans AppMobileChrome partout ailleurs. Une seule
// instance simultanée (l'un OU l'autre selon la route).
export function PwaBottomFrost() {
  return (
    <div className="nc-pwa-bottom-frost md:hidden">
      <GradualBlurOverlay
        anchor="bottom"
        height="calc(env(safe-area-inset-bottom, 0px) + 100px)"
        zIndex={38}
      />
    </div>
  );
}
