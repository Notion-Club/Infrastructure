"use client";

import { useCallback, useEffect, useState } from "react";

import { getClientVapidPublicKey } from "@/shared/lib/push/vapid";

// Hook client pour gérer la souscription Web Push depuis l'UI (toggle
// dans Réglages). Encapsule :
//   1. Détection du support (service worker + PushManager + Notification API)
//   2. Lecture de la permission Notification courante
//   3. `subscribe()` : demande permission + PushManager.subscribe + POST /api/push/subscribe
//   4. `unsubscribe()` : DELETE local + POST /api/push/unsubscribe
//
// Spécificité iOS Safari ≥ 16.4 : `PushManager.subscribe()` ne peut être
// appelé que depuis un user gesture (clic). C'est pour ça que l'UI doit
// déclencher ce hook depuis un onClick et pas un effet.

type SupportState =
  | { supported: false; reason: string }
  | { supported: true };

export type PushStatus = "loading" | "subscribed" | "denied" | "unsubscribed";

function detectSupport(): SupportState {
  if (typeof window === "undefined") {
    return { supported: false, reason: "ssr" };
  }
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "no_service_worker" };
  }
  if (!("PushManager" in window)) {
    return { supported: false, reason: "no_push_manager" };
  }
  if (!("Notification" in window)) {
    return { supported: false, reason: "no_notification" };
  }
  if (!getClientVapidPublicKey()) {
    return { supported: false, reason: "no_vapid_key" };
  }
  return { supported: true };
}

// Convertit la clé VAPID publique base64-url en ArrayBuffer attendu par
// `PushManager.subscribe({ applicationServerKey })`. On retourne un
// `ArrayBuffer` (et pas un `Uint8Array<ArrayBufferLike>`) pour matcher
// strictement `BufferSource` côté types DOM.
function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

// Vrai si la souscription existante a été créée avec la MÊME clé VAPID que la
// clé courante. Sinon (rotation de clé, ou souscription fantôme laissée par une
// MISE À JOUR DU SERVICE WORKER — WebKit/iOS invalide l'abonnement push quand le
// SW change) il faut la révoquer et en recréer une propre, sans quoi
// `subscribe()` échoue ou l'endpoint pointe dans le vide.
function subscriptionMatchesKey(
  sub: PushSubscription,
  desiredKey: ArrayBuffer,
): boolean {
  const existing = sub.options?.applicationServerKey;
  if (!existing) return false;
  const a = new Uint8Array(existing);
  const b = new Uint8Array(desiredKey);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export function usePushSubscription() {
  const [support, setSupport] = useState<SupportState>({
    supported: false,
    reason: "ssr",
  });
  const [status, setStatus] = useState<PushStatus>("loading");

  // Détection support + lecture de l'état initial (permission + existing sub).
  // Les `setState` sont défilés via `await Promise.resolve()` pour respecter
  // la règle ESLint `react-hooks/set-state-in-effect` du repo (cf. AGENTS.md
  // et autres composants : on évite le setState sync au mount).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.resolve();
      const detected = detectSupport();
      if (cancelled) return;
      setSupport(detected);

      if (!detected.supported) {
        setStatus("unsubscribed");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setStatus(existing ? "subscribed" : "unsubscribed");
      } catch {
        if (!cancelled) setStatus("unsubscribed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    if (!support.supported) return { ok: false, reason: support.reason };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return { ok: false, reason: "permission_denied" };
    }

    const publicKey = getClientVapidPublicKey();
    if (!publicKey) {
      return { ok: false, reason: "no_vapid_key" };
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const desiredKey = urlBase64ToArrayBuffer(publicKey);

      // Réutilise une souscription existante SEULEMENT si sa clé VAPID
      // correspond encore. Après une mise à jour du service worker, iOS/WebKit
      // laisse parfois une souscription périmée (endpoint mort / clé
      // incohérente) : la réutiliser telle quelle faisait échouer l'activation
      // (« Impossible de mettre à jour la souscription push »). On la révoque
      // alors avant d'en recréer une.
      let existing = await reg.pushManager.getSubscription();
      if (existing && !subscriptionMatchesKey(existing, desiredKey)) {
        await existing.unsubscribe().catch(() => {});
        existing = null;
      }

      let subscription: PushSubscription;
      if (existing) {
        subscription = existing;
      } else {
        try {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: desiredKey,
          });
        } catch {
          // Rare mais réel sur iOS PWA : un abonnement résiduel bloque la
          // recréation. On purge tout ce qui traîne puis on retente UNE fois.
          const stale = await reg.pushManager.getSubscription();
          if (stale) await stale.unsubscribe().catch(() => {});
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: desiredKey,
          });
        }
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) {
        // Rollback : si la persistence DB échoue, on retire l'abo browser
        // pour ne pas avoir un device-side fantôme.
        await subscription.unsubscribe().catch(() => {});
        return { ok: false, reason: "subscribe_persist_failed" };
      }
      setStatus("subscribed");
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "subscribe_failed",
      };
    }
  }, [support]);

  const unsubscribe = useCallback(async () => {
    if (!support.supported) return { ok: true };
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (!existing) {
        setStatus("unsubscribed");
        return { ok: true };
      }
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: existing.endpoint }),
      }).catch(() => {});
      await existing.unsubscribe();
      setStatus("unsubscribed");
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "unsubscribe_failed",
      };
    }
  }, [support]);

  return {
    support,
    status,
    subscribe,
    unsubscribe,
  };
}
