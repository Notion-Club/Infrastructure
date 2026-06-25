"use client";

import { useContext, useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import { ThemeContext } from "./ThemeProvider";

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

// ── Écriture de la balise ────────────────────────────────────────────────
function writeThemeColor(color: string) {
  if (typeof document === "undefined") return;
  let tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "theme-color");
    document.head.appendChild(tag);
  } else {
    // La balise statique émise par Next peut porter un attribut `media` ;
    // on le neutralise pour que notre valeur s'applique inconditionnellement.
    tag.removeAttribute("media");
  }
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
  const color = override ?? SURFACE_COLOR[theme];

  // Persistance du thème à la navigation. Le `.dark` est posé impérativement
  // sur <html> (ThemeProvider.applyTheme). À chaque navigation client, React
  // peut réconcilier <html> et RETIRER cette classe (le className SSR ne la
  // contient pas) → la nouvelle page repart en light (bandeaux qui
  // redeviennent blancs en dark mode). On dépend de `usePathname` pour
  // re-render à chaque route, et on RÉ-APPLIQUE la classe en useLayoutEffect
  // (avant paint → aucun flash). Idempotent : sans strip, c'est un no-op.
  useIsoLayoutEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [pathname, theme]);

  // Écriture après paint : le premier rendu garde la balise statique (SSR),
  // puis on l'aligne sur le thème réel côté client.
  useEffect(() => {
    writeThemeColor(color);
  }, [color]);

  return null;
}
