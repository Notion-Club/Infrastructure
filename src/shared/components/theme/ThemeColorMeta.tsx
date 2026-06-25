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

// ── Persistance du thème + couleur des calques « glass » ────────────────────
//
// Bug iOS/WebKit : un calque `backdrop-filter` NE se repeint PAS quand la
// couleur de son `background` change via une CUSTOM PROPERTY d'un ancêtre
// (ici `--color-surface-page` / `--nc-bottom-nav-bg` qui basculent avec `.dark`)
// → les bandes restaient figées sur l'ancienne couleur jusqu'à un re-composite
// (l'utilisateur devait tourner l'écran). Retirer/remettre `backdrop-filter`
// NE suffit pas (iOS garde le fond peint en cache).
//
// Seule solution fiable : MUTER DIRECTEMENT le `background` de l'élément avec
// une valeur EXPLICITE (pas une variable). Une mutation inline directe sur
// l'élément invalide son rendu → iOS repeint, immédiatement.
//
// ⚠️ Les valeurs ci-dessous doivent rester synchro avec globals.css
// (`.nc-mobile-top-fade`, `.nc-mobile-bottom-fade`, `--nc-bottom-nav-bg`).
// Surfaces : light #f5f2f2 = rgb(245,242,242) · dark #141211 = rgb(20,18,17).
const GLASS_BG: Record<string, { light: string; dark: string }> = {
  ".nc-mobile-top-fade": {
    light:
      "linear-gradient(to bottom, rgba(245,242,242,0.72) 0%, rgba(245,242,242,0.26) 50%, transparent 100%)",
    dark: "linear-gradient(to bottom, rgba(20,18,17,0.72) 0%, rgba(20,18,17,0.26) 50%, transparent 100%)",
  },
  ".nc-mobile-bottom-fade": {
    light:
      "linear-gradient(to top, rgba(245,242,242,1) 0%, rgba(245,242,242,0.55) 55%, transparent 100%)",
    dark: "linear-gradient(to top, rgba(20,18,17,1) 0%, rgba(20,18,17,0.55) 55%, transparent 100%)",
  },
  ".nc-bottom-nav": {
    light: "rgba(255,255,255,0.92)",
    dark: "rgba(28,25,23,0.88)",
  },
};

function applyGlassTheme(dark: boolean) {
  if (typeof document === "undefined") return;
  for (const selector of Object.keys(GLASS_BG)) {
    const bg = dark ? GLASS_BG[selector].dark : GLASS_BG[selector].light;
    document
      .querySelectorAll<HTMLElement>(selector)
      .forEach((el) => el.style.setProperty("background", bg));
  }
}

let lastEnforcedDark: boolean | null = null;

// Aligne `.dark` de <html> sur le thème résolu (source = localStorage, lue en
// direct → pas de course avec le rendu/streaming React) ET ré-applique la
// couleur explicite des bandes glass à chaque bascule. Idempotent
// (`toggle(force)` ne mute que si l'état change → pas de boucle avec l'observer).
function enforceTheme() {
  if (typeof document === "undefined") return;
  const dark = getResolvedTheme() === "dark";
  const html = document.documentElement;
  if (html.classList.contains("dark") !== dark) {
    html.classList.toggle("dark", dark);
  }
  if (lastEnforcedDark !== dark) {
    lastEnforcedDark = dark;
    applyGlassTheme(dark);
  }
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

  // Persistance — chemin RAPIDE pré-paint à chaque navigation (pas de flash).
  // theme en dépendance pour ré-appliquer aussi dès la bascule de thème.
  useIsoLayoutEffect(() => {
    enforceTheme();
  }, [pathname, theme]);

  // Persistance — garde PERMANENTE hors cycle React. Le `.dark` posé sur <html>
  // peut être retiré par React lors d'une réconciliation (navigation, streaming
  // RSC, boundary de loading), parfois dans un commit ULTÉRIEUR à l'effet
  // ci-dessus. Un MutationObserver sur la classe de <html> ré-applique la bonne
  // classe quel que soit le moment du strip, et re-composite les bandes glass
  // figées (bug backdrop-filter + custom property iOS).
  useEffect(() => {
    enforceTheme();
    const observer = new MutationObserver(enforceTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Écriture après paint : le premier rendu garde la balise statique (SSR),
  // puis on l'aligne sur le thème réel côté client.
  useEffect(() => {
    writeThemeColor(color);
  }, [color]);

  return null;
}
