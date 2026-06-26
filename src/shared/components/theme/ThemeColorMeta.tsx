"use client";

import { useContext, useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import { ThemeContext, getResolvedTheme } from "./ThemeProvider";

// `useLayoutEffect` avant paint côté client (pas de flash à la navigation),
// `useEffect` côté serveur pour éviter le warning SSR React.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// ============================================================================
// ThemeColorMeta — pilote dynamiquement <meta name="theme-color">.
//
// Pourquoi : sur iOS Safari **mode navigateur** (hors PWA), la zone du notch /
// barre d'adresse (haut) ET la barre d'outils (bas) sont teintées par
// `theme-color`. Si cette teinte ne correspond pas à la surface réelle, une
// bande claire « blanche » reste autour du contenu → ça casse l'effet
// plein-écran / liquid glass d'iOS.
//
// Le bug d'origine : `theme-color` était déclaré statiquement par
// `prefers-color-scheme` (réglage OS) dans `viewport`. Or le thème réel de
// l'app est piloté par un store JS custom (`localStorage` → classe `.dark`,
// cf. ThemeProvider) qui peut DIVERGER de l'OS (thème sombre choisi alors que
// le téléphone est en clair, ou l'inverse). Résultat : barres claires autour
// d'une UI sombre, ou l'inverse.
//
// Correctif : on abandonne la déduction par média et on écrit la balise
// `theme-color` depuis le thème EFFECTIVEMENT appliqué. Les barres épousent
// alors toujours la surface → plus de bande qui jure.
//
// Note : on ne peut PAS supprimer les barres en mode navigateur (chrome du
// navigateur). Le plein-écran réellement immersif reste la PWA installée.
// ============================================================================

// Doit rester synchro avec `--color-surface-page` dans globals.css.
const SURFACE_COLOR: Record<"light" | "dark", string> = {
  light: "#f5f2f2",
  dark: "#141211",
};

// ── Override store ─────────────────────────────────────────────────────────
// Permet à un overlay dont le fond DIFFÈRE de la surface de page (ex. lightbox
// plein écran sombre) de forcer la teinte le temps de son affichage. On empile
// les requêtes (plusieurs overlays possibles) et on applique la dernière ;
// pile vidée → retour à la couleur du thème.
//
// Le pop-up d'installation PWA n'en a PAS besoin : son panneau utilise
// `--color-surface-page`, donc la synchro de thème ci-dessous le couvre déjà
// (il n'est « sombre » qu'en thème sombre, où les barres passent en #141211).
const overrideStack: string[] = [];
const overrideListeners = new Set<() => void>();
let overrideSnapshot: string | null = null;

function emitOverride() {
  overrideSnapshot = overrideStack.length
    ? overrideStack[overrideStack.length - 1]
    : null;
  overrideListeners.forEach((cb) => cb());
}

/**
 * Force `theme-color` à `color` jusqu'à l'appel de la fonction retournée.
 * Idempotent : appeler le releaser plusieurs fois ne retire qu'une entrée.
 */
export function pushThemeColorOverride(color: string): () => void {
  overrideStack.push(color);
  emitOverride();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const idx = overrideStack.lastIndexOf(color);
    if (idx !== -1) overrideStack.splice(idx, 1);
    emitOverride();
  };
}

function subscribeOverride(cb: () => void): () => void {
  overrideListeners.add(cb);
  return () => overrideListeners.delete(cb);
}

function getOverrideSnapshot(): string | null {
  return overrideSnapshot;
}

function getServerOverrideSnapshot(): string | null {
  return null;
}

// ── Garde de persistance de la classe `.dark` ───────────────────────────────
// Le `.dark` est posé impérativement sur <html> (ThemeProvider.applyTheme).
// React peut le RETIRER en réconciliant <html> à la navigation / au streaming
// RSC → la page suivante repartait en light. On le RÉ-APPLIQUE depuis la source
// de vérité (localStorage, via getResolvedTheme → pas de course avec le rendu).
// Idempotent (toggle force) → pas de boucle avec le MutationObserver.
//
// Les bandes « glass » (voiles + BottomNav) suivent désormais le thème PAR CSS
// (calques couleur SANS backdrop-filter, cf. globals.css) → plus aucune
// manipulation JS de leur couleur, ni d'astuce de re-composite.
function enforceThemeClass() {
  if (typeof document === "undefined") return;
  const dark = getResolvedTheme() === "dark";
  const html = document.documentElement;
  if (html.classList.contains("dark") !== dark) {
    html.classList.toggle("dark", dark);
  }
}

export function ThemeColorMeta() {
  const ctx = useContext(ThemeContext);
  const pathname = usePathname();
  const override = useSyncExternalStore(
    subscribeOverride,
    getOverrideSnapshot,
    getServerOverrideSnapshot,
  );
  const theme = ctx?.theme ?? "light";
  const color = override ?? SURFACE_COLOR[theme];

  // Persistance — chemin RAPIDE pré-paint à chaque navigation (pas de flash).
  useIsoLayoutEffect(() => {
    enforceThemeClass();
  }, [pathname, theme]);

  // Persistance — garde PERMANENTE hors cycle React. Le `.dark` posé sur <html>
  // peut être retiré par React dans un commit ultérieur (réconciliation,
  // streaming RSC). Un MutationObserver ré-applique la bonne classe quel que
  // soit le moment du strip.
  useEffect(() => {
    enforceThemeClass();
    const observer = new MutationObserver(enforceThemeClass);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Balise rendue DÉCLARATIVEMENT → React 19 la hoiste dans <head> et en reste
  // SEUL propriétaire. On ne touche plus jamais le DOM du <head> à la main.
  //
  // Pourquoi ce changement est critique : l'ancienne version écrivait la balise
  // impérativement (`querySelector` + `appendChild`/`setAttribute`) sur le nœud
  // `<meta theme-color>` que React 19 gère lui-même (métadonnées hoistées). À la
  // navigation, quand React réconciliait le <head>, son `stateNode` pointait sur
  // un nœud qu'on avait muté/déplacé → `parentNode` null → `removeChild` jetait
  // EN PLEINE PHASE COMMIT → React avortait tout le commit (navigation figée,
  // spinner infini, dropdown gelé). En rendant la balise via JSX, la mise à jour
  // passe par la réconciliation normale de React : aucune collision possible.
  //
  // `suppressHydrationWarning` : le SSR rend la couleur du thème par défaut
  // (light), mais au 1ᵉʳ rendu client le thème réel (localStorage) peut être
  // sombre → contenu volontairement divergent, sans warning d'hydratation.
  return (
    <meta name="theme-color" content={color} suppressHydrationWarning />
  );
}
