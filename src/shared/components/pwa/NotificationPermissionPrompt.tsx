"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { enablePushChannelAction } from "@/modules/settings";
import { usePushSubscription } from "@/shared/lib/hooks/usePushSubscription";
import { NotificationPermissionModal } from "./NotificationPermissionModal";

// ============================================================================
// NotificationPermissionPrompt — orchestre le pop-up d'opt-in notifications.
//
// Jumeau du PwaInstallPrompt, côté notifications. S'ouvre automatiquement
// quelques secondes après l'ouverture de l'app, pour proposer d'activer les
// notifications push. Monté dans (app)/layout.tsx (HORS de tout nc-page-halo).
//
// Règles d'affichage (produit) :
//   • UNIQUEMENT en mode installé (standalone) — c'est « ouvrir l'app PWA »
//     sur iOS / Android. Sur iOS Safari, le Web Push ne marche QUE dans ce
//     mode → inutile de demander ailleurs ;
//   • uniquement si le navigateur supporte le push ET que la permission n'est
//     pas encore tranchée (`status === "unsubscribed"`) : on ne harcèle pas un
//     user déjà abonné, et on ne peut de toute façon pas re-demander après un
//     refus natif (`denied`) ;
//   • une seule fois par navigateur (flag localStorage).
//
// Au clic sur le CTA :
//   1. `push.subscribe()` → demande la permission NATIVE iOS/Android, crée la
//      souscription PushManager, persiste l'endpoint (push_subscriptions) ;
//   2. si accepté → `enablePushChannelAction()` coche le canal « push » dans le
//      tableau de préférences (channel_preferences + notification_preferences) ;
//   3. toast de confirmation puis fermeture animée.
//
// Le clic est indispensable : iOS Safari ≥ 16.4 refuse `pushManager.subscribe()`
// hors user gesture (cf. usePushSubscription).
// ============================================================================

// Clé localStorage — bumper le suffixe pour ré-afficher après une refonte.
// (Re-test local : localStorage.removeItem("nc-push-prompt-seen-v1").)
const SEEN_KEY = "nc-push-prompt-seen-v1";

// Délai avant ouverture auto : « dans les premières secondes » après l'arrivée
// sur l'app, sans casser le premier rendu. Légèrement plus long que l'install
// pour ne jamais empiler les deux pop-ups.
const OPEN_DELAY_MS = 3000;

// Durée de l'animation de fermeture la plus longue (slide-down mobile =
// --nc-duration-slow). Doit rester synchro avec globals.css.
const CLOSE_ANIM_MS = 300;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)")?.matches;
  // iOS expose navigator.standalone (non standard, hors lib.dom).
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return Boolean(mql || iosStandalone);
}

export function NotificationPermissionPrompt() {
  // `mounted` = présent dans le DOM ; `visible` = data-open=true (transition).
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activating, setActivating] = useState(false);

  const push = usePushSubscription();

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  // Garde-fou : on ne planifie l'ouverture qu'une fois (l'effet décisionnel
  // re-tourne quand `push.status` passe de "loading" à sa valeur réelle).
  const scheduledRef = useRef(false);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Mode privé / stockage bloqué : échec silencieux, le pop-up se
      // ré-affichera au prochain chargement (acceptable).
    }
  }, []);

  const open = useCallback(() => {
    setMounted(true);
    // « Vu » dès l'ouverture → pas de ré-affichage au reload suivant.
    markSeen();
    // Deux frames : monter à l'état fermé puis basculer data-open=true.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setVisible(true));
    });
  }, [markSeen]);

  const close = useCallback(() => {
    setVisible(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setMounted(false);
      closeTimer.current = null;
    }, CLOSE_ANIM_MS);
  }, []);

  // CTA principal : permission native → souscription → coche canal push.
  const handleActivate = useCallback(async () => {
    setActivating(true);
    const result = await push.subscribe();
    setActivating(false);

    if (!result.ok) {
      if (result.reason === "permission_denied") {
        toast.error(
          "Permission refusée. Tu peux réactiver les notifications depuis Réglages.",
        );
      } else if (result.reason !== "no_vapid_key") {
        toast.error("Impossible d'activer les notifications pour le moment.");
      }
      close();
      return;
    }

    // Souscription OK → on reflète le choix dans le tableau de préférences.
    const persisted = await enablePushChannelAction().catch(() => null);
    if (persisted && !persisted.ok) {
      // L'abo navigateur a réussi mais l'écriture des préférences a échoué :
      // les notifs arriveront quand même, on ne bloque pas l'utilisateur.
      console.error("[push prompt] enablePushChannel failed:", persisted.message);
    }
    toast.success("Notifications activées 🎉");
    close();
  }, [push, close]);

  // Décision d'ouverture auto. Re-tourne quand le hook a fini de détecter le
  // support et la permission (`push.status` quitte "loading").
  useEffect(() => {
    if (scheduledRef.current) return;
    if (!isStandalone()) return; // pas en app installée → on ne propose pas
    if (push.status === "loading") return; // détection en cours
    if (!push.support.supported) return; // push indisponible sur ce navigateur
    if (push.status !== "unsubscribed") return; // déjà abonné ou refusé

    let alreadySeen = false;
    try {
      alreadySeen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      alreadySeen = false;
    }
    if (alreadySeen) return;

    scheduledRef.current = true;
    openTimer.current = setTimeout(open, OPEN_DELAY_MS);
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    };
  }, [push.status, push.support, open]);

  // Lock du scroll de fond + fermeture clavier (Escape) tant que monté.
  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, close]);

  // Nettoyage des timers / frames au démontage.
  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <NotificationPermissionModal
      mounted={mounted}
      visible={visible}
      activating={activating}
      onActivate={handleActivate}
      onDismiss={close}
    />
  );
}
