// Helpers de scroll pour l'app-shell.
//
// Depuis le passage en app-shell, le scroll des routes (app) vit dans le
// conteneur `#app-scroll`, plus dans le document. Tout code qui faisait
// `window.scrollTo(...)` doit cibler ce conteneur. Fallback `window` pour les
// routes hors (app) (auth, legal) où `#app-scroll` n'existe pas.

export function getAppScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("app-scroll");
}

export function scrollAppToTop(behavior: ScrollBehavior = "instant") {
  const el = getAppScroller();
  if (el) {
    el.scrollTo({ top: 0, behavior });
  } else if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior });
  }
}
