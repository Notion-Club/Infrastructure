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
//   • uniquement si le navigateur supporte le push ET que les notifications
//     push NE SONT PAS encore activées (`status !== "subscribed"`). On couvre
//     donc « permission pas encore demandée » ET « déjà refusée » → tant que
//     l'utilisateur n'a pas activé, on (re)propose ;
//   • fréquence : pilotée par REPROMPT_POLICY (cf. ci-dessous). Aujourd'hui
//     « always » → à CHAQUE ouverture de l'app. Plus tard « daily » → 1×/jour.
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

// Fréquence de ré-affichage. Une seule ligne à changer le jour où on accueille
// les vrais membres :
//   • "always" → le pop-up s'ouvre à CHAQUE ouverture de l'app tant que le push
//     n'est pas activé (comportement voulu aujourd'hui) ;
//   • "daily"  → au plus 1×/jour calendaire (anti-harcèlement en prod), sans
//     limite dans le temps : tous les jours où les notifs ne sont pas activées.
const REPROMPT_POLICY: "always" | "daily" = "always";

// Clé localStorage utilisée uniquement par la policy "daily" (date du dernier
// affichage, AAAA-MM-JJ). Inutile en "always". (Re-test : localStorage
// .removeItem("nc-push-prompt-last-shown").)
const LAST_SHOWN_KEY = "nc-push-prompt-last-shown";

// Date du jour (AAAA-MM-JJ) en heure locale, sans dépendre de Date.now() côté
// type — suffisant pour un cap journalier best-effort.
function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// La policy autorise-t-elle un affichage maintenant ?
function passesFrequencyPolicy(): boolean {
  if (REPROMPT_POLICY === "always") return true;
  try {
    return window.localStorage.getItem(LAST_SHOWN_KEY) !== todayStamp();
  } catch {
    // Stockage bloqué (mode privé) → on n'empêche pas l'affichage.
    return true;
  }
}

// Mémorise l'affichage du jour (no-op en policy "always").
function recordShown(): void {
  if (REPROMPT_POLICY !== "daily") return;
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, todayStamp());
  } catch {
    // Stockage bloqué : on échoue silencieusement (le cap retombe sur "always").
  }
}

// Délai avant ouverture auto : « dès l'ouverture », juste après le premier
// rendu pour ne pas le bloquer. Court → le pop-up se sent immédiat.
const OPEN_DELAY_MS = 1500;

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

  const open = useCallback(() => {
    setMounted(true);
    // Trace l'affichage du jour (utile seulement en policy "daily" ; no-op en
    // "always" → réouverture à chaque lancement).
    recordShown();
    // Deux frames : monter à l'état fermé puis basculer data-open=true.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setVisible(true));
    });
  }, []);

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

    // Notifications autorisées → on referme TOUT DE SUITE le pop-up (slide-down
    // vers le bas) et on affiche la confirmation : l'utilisateur n'attend pas
    // l'écriture des préférences.
    toast.success("Notifications activées 🎉");
    close();

    // L'écriture du canal push se fait en arrière-plan (fire-and-forget) : si
    // elle échoue, les notifs arrivent quand même, on ne re-bloque pas l'UI.
    void enablePushChannelAction()
      .then((persisted) => {
        if (persisted && !persisted.ok) {
          console.error(
            "[push prompt] enablePushChannel failed:",
            persisted.message,
          );
        }
      })
      .catch(() => undefined);
  }, [push, close]);

  // Décision d'ouverture auto. Re-tourne quand le hook a fini de détecter le
  // support et la permission (`push.status` quitte "loading").
  useEffect(() => {
    if (scheduledRef.current) return;
    if (!isStandalone()) return; // pas en app installée → on ne propose pas
    if (push.status === "loading") return; // détection en cours
    if (!push.support.supported) return; // push indisponible sur ce navigateur
    if (push.status === "subscribed") return; // déjà activé → on n'embête pas
    if (!passesFrequencyPolicy()) return; // cap de fréquence (always / daily)

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
