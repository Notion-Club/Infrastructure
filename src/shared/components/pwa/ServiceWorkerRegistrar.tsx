"use client";

import { useEffect } from "react";

// Enregistre /sw.js dès que la page est chargée. Composant client monté
// dans le root layout — donc actif sur toutes les pages, y compris /login
// (un visiteur peut ainsi installer la PWA avant même de se connecter).
//
// Conditions :
//   • Service Worker supporté (filtré ici, évite les warnings sur les vieux
//     navigateurs).
//   • Pas en mode dev (Next dev server gère mal les SW — invalidation du
//     bundle Turbopack à chaque save). En prod, `process.env.NODE_ENV`
//     vaut "production".
//
// Le SW est volontairement non bloquant : aucune attente d'enregistrement,
// aucune UI affichée. Toute erreur est logguée en console — pas de toast
// pour ne pas polluer l'expérience d'un user qui ne sait pas ce qu'est un
// SW.

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        // Force un check d'update à chaque visite pour ne pas rester
        // bloqué sur une vieille version après un déploiement Vercel.
        registration.update().catch(() => {});
      } catch (error) {
        console.warn("[pwa] service worker registration failed", error);
      }
    };

    // Différé après le `load` pour ne pas concurrencer le first paint.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
