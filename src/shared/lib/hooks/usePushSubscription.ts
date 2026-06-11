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
      // Réutilise une souscription existante si présente — un endpoint
      // déjà actif ne doit pas être re-créé inutilement.
      const existing = await reg.pushManager.getSubscription();
      const subscription =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(publicKey),
        }));

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
