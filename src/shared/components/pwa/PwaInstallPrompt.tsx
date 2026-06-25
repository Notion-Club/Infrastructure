"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PwaInstallModal } from "./PwaInstallModal";

// ============================================================================
// PwaInstallPrompt — orchestre le pop-up d'installation PWA.
//
// Affiche PwaInstallModal automatiquement quelques secondes après l'ouverture
// de l'app, pour inciter à « ajouter à l'écran d'accueil ». Monté dans
// (app)/layout.tsx (HORS de tout nc-page-halo, comme le pop-up profil).
//
// Règles d'affichage (produit) :
//   • jamais si l'app tourne DÉJÀ en mode installé (standalone) — inutile ;
//   • une seule fois par navigateur (flag localStorage), pour ne pas harceler ;
//   • Android / Chromium : capture `beforeinstallprompt` → CTA déclenche la
//     vraie invite d'installation native ;
//   • iOS Safari (pas de `beforeinstallprompt`) : l'animation en boucle montre
//     déjà la marche à suivre (Partager → Sur l'écran d'accueil), le CTA se
//     contente de fermer.
//
// L'ouverture / fermeture animées reprennent le pattern du pop-up profil :
// on découple `mounted` (présence DOM) de `visible` (data-open → transition),
// et on démonte après la durée d'animation de fermeture.
// ============================================================================

// Clé localStorage — bumper le suffixe (`-v1`) si on veut ré-afficher le
// pop-up à toute la base après une refonte. (Pour re-tester en local :
// localStorage.removeItem("nc-pwa-prompt-seen-v1").)
const SEEN_KEY = "nc-pwa-prompt-seen-v1";

// Délai avant ouverture auto : « dans les premières secondes » après l'arrivée
// sur l'app, sans casser le premier rendu.
const OPEN_DELAY_MS = 2500;

// Durée de l'animation de fermeture la plus longue (slide-down mobile =
// --nc-duration-slow). Doit rester synchro avec globals.css.
const CLOSE_ANIM_MS = 300;

// Type minimal de l'event Chromium (non typé dans lib.dom).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)")?.matches;
  // iOS expose navigator.standalone (non standard, hors lib.dom).
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return Boolean(mql || iosStandalone);
}

export function PwaInstallPrompt() {
  // `mounted` = présent dans le DOM ; `visible` = data-open=true (transition).
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  // Android/Chromium : invite native différée. iOS reste null → CTA informatif.
  const [canInstall, setCanInstall] = useState(false);

  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Mode privé / stockage bloqué : on échoue silencieusement, le pop-up
      // se ré-affichera au prochain chargement (acceptable).
    }
  }, []);

  const open = useCallback(() => {
    setMounted(true);
    // On considère le pop-up « vu » dès l'ouverture → pas de ré-affichage au
    // reload suivant.
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

  // CTA principal : invite native si dispo (Android), sinon simple fermeture
  // (iOS suit l'animation).
  const handleInstall = useCallback(async () => {
    const evt = deferredPrompt.current;
    if (evt) {
      await evt.prompt();
      await evt.userChoice.catch(() => undefined);
      deferredPrompt.current = null;
      setCanInstall(false);
    }
    close();
  }, [close]);

  // Capture de l'invite native Chromium (avant la décision d'ouverture).
  useEffect(() => {
    function onBeforeInstall(e: Event) {
      // Empêche la mini-infobar Chrome → on pilote l'invite via notre CTA.
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  // Décision d'ouverture auto, une fois côté client.
  useEffect(() => {
    if (isStandalone()) return; // déjà installé → rien à proposer
    let alreadySeen = false;
    try {
      alreadySeen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      alreadySeen = false;
    }
    if (alreadySeen) return;

    openTimer.current = setTimeout(open, OPEN_DELAY_MS);
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    };
  }, [open]);

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
    <PwaInstallModal
      mounted={mounted}
      visible={visible}
      title="Ajoute l'app du Notion Club"
      canInstall={canInstall}
      onInstall={handleInstall}
      onDismiss={close}
    />
  );
}
