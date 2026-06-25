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

// ── Persistance du thème + repaint des calques « glass » ────────────────────
// Calques `backdrop-filter` dont la couleur de fond suit le thème via une
// custom property (`--color-surface-page` / `--nc-bottom-nav-bg`).
const GLASS_SELECTOR =
  ".nc-mobile-top-fade, .nc-mobile-bottom-fade, .nc-bottom-nav";

// Bug iOS/WebKit : un calque `backdrop-filter` NE se repeint PAS quand une
// custom property de son `background` change → au passage en dark, ces bandes
// restent figées sur l'ancienne couleur jusqu'à un re-composite (l'utilisateur
// devait tourner l'écran en paysage). On force le re-composite : on retire le
// filtre une frame, on le restaure à la suivante → repaint avec la bonne
// couleur. On sauvegarde/restaure la valeur calculée (CSS pour les fondus,
// inline pour la BottomNav) pour ne casser ni l'un ni l'autre.
function repaintGlassLayers() {
  if (typeof document === "undefined") return;
  const els = Array.from(
    document.querySelectorAll<HTMLElement>(GLASS_SELECTOR),
  );
  if (els.length === 0) return;
  for (const el of els) {
    const gcs = getComputedStyle(el);
    el.dataset.ncGlass =
      gcs.getPropertyValue("backdrop-filter") ||
      gcs.getPropertyValue("-webkit-backdrop-filter") ||
      "";
    el.style.setProperty("backdrop-filter", "none");
    el.style.setProperty("-webkit-backdrop-filter", "none");
  }
  requestAnimationFrame(() => {
    for (const el of els) {
      const value = el.dataset.ncGlass ?? "";
      el.style.setProperty("backdrop-filter", value);
      el.style.setProperty("-webkit-backdrop-filter", value);
      delete el.dataset.ncGlass;
    }
  });
}

let lastEnforcedDark: boolean | null = null;

// Aligne `.dark` de <html> sur le thème résolu (source = localStorage, lue en
// direct → pas de course avec le rendu/streaming React) ET re-composite les
// calques glass figés à chaque bascule. Idempotent (`toggle(force)` ne mute
// que si l'état change → pas de boucle avec le MutationObserver).
function enforceTheme() {
  if (typeof document === "undefined") return;
  const dark = getResolvedTheme() === "dark";
  const html = document.documentElement;
  if (html.classList.contains("dark") !== dark) {
    html.classList.toggle("dark", dark);
  }
  if (lastEnforcedDark !== dark) {
    lastEnforcedDark = dark;
    repaintGlassLayers();
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
