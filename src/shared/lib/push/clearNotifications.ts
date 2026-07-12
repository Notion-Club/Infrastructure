"use client";

// Demande au service worker de fermer les notifications push déjà affichées
// qui pointent vers `url` (le deep-link posé dans `data.url` par le handler
// push de public/sw.js). Utilisé quand l'utilisateur a LU le contenu — par
// exemple à l'ouverture d'une conversation, ou à la réception d'un message
// dans la conversation déjà ouverte : la notif « nouveau message »
// correspondante doit alors disparaître du centre de notifications.
//
// No-op silencieux si les service workers ne sont pas supportés (SSR, desktop
// sans SW enregistré, navigation privée) — la fonction ne throw jamais.
export function clearPushNotifications(url?: string): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage({ type: "CLEAR_NOTIFICATIONS", url });
    })
    .catch(() => {
      /* SW non prêt / non supporté → on ignore */
    });
}
