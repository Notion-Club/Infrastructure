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
// Correctif : on pilote la balise depuis le thème EFFECTIVEMENT appliqué, sur la
// couleur de surface UNIFORME de la page.
//   - SOMBRE : `#141211` (barres near-black sur UI sombre).
//   - CLAIR : `#f5f2f2` (surface claire).
// On ne peut PAS rendre le chrome Safari translucide (testé : retirer la balise
// → Safari retombe sur un matériau clair ≈ blanc). On ne contrôle que sa
// COULEUR. La clé : le dégradé `.nc-app-bg` est conçu pour FONDRE vers cette
// même surface en haut/bas (accents repoussés sur les côtés) → les barres
// Safari prolongent la page sans cassure (cf. globals.css `.nc-app-bg`).
//
// Note : on ne peut PAS supprimer les barres Safari en mode navigateur (c'est
// son chrome) ; on ne contrôle que leur couleur via theme-color.
// ============================================================================

// Teintes du chrome Safari (barres haut/bas, mode navigateur) = surface UNIFORME
// de la page. DOIVENT rester synchro avec `--color-surface-page` (globals.css)
// et avec la couleur vers laquelle le dégradé `.nc-app-bg` fond en haut/bas →
// barres Safari, overscroll et bords du dégradé identiques, sans cassure.
//   - CLAIR : #f5f2f2 (surface claire).
//   - SOMBRE : #141211 (surface near-black).
const LIGHT_CHROME = "#f5f2f2";
const DARK_SURFACE = "#141211";

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

// ── Écriture / retrait de la balise ───────────────────────────────────────
// `color === null` → on RETIRE toute balise theme-color (statique ou écrite
// précédemment) pour laisser Safari peindre ses barres en matériau translucide
// natif (le dégradé transparaît derrière, plus de bande blanche opaque).
function applyThemeColor(color: string | null) {
  if (typeof document === "undefined") return;
  const tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (color === null) {
    if (tag) tag.remove();
    return;
  }
  if (!tag) {
    const created = document.createElement("meta");
    created.setAttribute("name", "theme-color");
    created.setAttribute("content", color);
    document.head.appendChild(created);
    return;
  }
  // La balise statique émise par Next peut porter un attribut `media` ;
  // on le neutralise pour que notre valeur s'applique inconditionnellement.
  tag.removeAttribute("media");
  tag.setAttribute("content", color);
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
  // Clair → surface claire #f5f2f2 ; sombre → near-black ; un override éventuel
  // (overlay) prime toujours.
  const color = override ?? (theme === "dark" ? DARK_SURFACE : LIGHT_CHROME);

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

  // Écriture après paint : le premier rendu garde la balise statique (SSR),
  // puis on l'aligne sur le thème réel côté client (retrait pur en clair).
  useEffect(() => {
    applyThemeColor(color);
  }, [color]);

  return null;
}
