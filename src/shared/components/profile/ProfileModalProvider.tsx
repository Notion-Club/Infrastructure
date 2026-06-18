"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ProfileEditor } from "./ProfileEditor";

// ============================================================================
// ProfileModalProvider (#128) — ouvre l'éditeur de profil public depuis
// n'importe où (menu compte de la Topbar / MobileTopActions, recap dans
// /settings).
//
// Rendu : modale centrée sur desktop, bottom sheet aux 3/4 de l'écran sur
// mobile (le haut laisse voir le fond de page flouté). Cf. classes
// `.nc-profile-*` dans globals.css.
//
// Ouverture / fermeture animées (slide-up ↔ slide-down sur mobile, scale +
// fade sur desktop) : on découple le « montage » (présence dans le DOM) du
// « visible » (attribut data-open qui déclenche la transition). À la
// fermeture, on retire d'abord data-open pour jouer l'animation de descente,
// puis on démonte après la durée de transition.
//
// Monté dans (app)/layout.tsx, donc HORS de tout `nc-page-halo`
// (isolation: isolate) : la racine en `position: fixed` n'est jamais cassée
// par un filtre/isolation d'ancêtre.
// ============================================================================

// Durée de l'animation de fermeture la plus longue (slide-down mobile =
// --nc-duration-slow). Doit rester synchro avec globals.css.
const CLOSE_ANIM_MS = 300;

type ProfileModalContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const ProfileModalContext = createContext<ProfileModalContextValue | null>(null);

export function useProfileModal(): ProfileModalContextValue {
  const ctx = useContext(ProfileModalContext);
  if (!ctx) return { isOpen: false, open: () => {}, close: () => {} };
  return ctx;
}

export function ProfileModalProvider({ children }: { children: ReactNode }) {
  // `mounted` = présent dans le DOM ; `visible` = data-open=true (transition).
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const open = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setMounted(true);
    // Deux frames : on monte d'abord à l'état fermé (transform translateY(100%)
    // / scale 0.96), puis on bascule data-open=true pour jouer la transition.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // On laisse l'animation de descente se jouer avant de démonter.
    closeTimer.current = setTimeout(() => {
      setMounted(false);
      closeTimer.current = null;
    }, CLOSE_ANIM_MS);
  }, []);

  // `isOpen` exposé au reste de l'app = intention d'ouverture (visible),
  // pas la présence transitoire pendant l'animation de fermeture.
  const isOpen = visible;

  // Lock du scroll de fond + fermeture clavier (Escape) tant que la modale est
  // montée.
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

  // Nettoyage des timers / frames au démontage du provider.
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <ProfileModalContext.Provider value={{ isOpen, open, close }}>
      {/* Zone floutée = TOUTE l'app (barre de navigation incluse). On floute
          directement le contenu via `filter` sur cet ancêtre — fiable y compris
          sur la Topbar fixed (que `backdrop-filter` ne capturait pas à cause de
          sa couche de compositing `translateZ(0)`). Le pop-up profil est rendu
          en SIBLING, hors de cette zone, donc il reste net. Desktop uniquement
          (cf. globals.css) ; sur mobile, le bottom sheet garde son backdrop. */}
      <div
        className="nc-app-blurzone"
        data-profile-open={visible ? "true" : "false"}
      >
        {children}
      </div>
      {mounted && (
        <div
          className="nc-profile-modal-root"
          data-open={visible ? "true" : "false"}
          role="dialog"
          aria-modal="true"
          aria-label="Mon profil"
        >
          {/* Backdrop — fond de page flouté visible (surtout sur le quart
              supérieur du sheet mobile). Clic = fermeture (descente). */}
          <div className="nc-profile-backdrop" onClick={close} aria-hidden />
          <div className="nc-profile-panel" data-fb-label="Éditeur de profil">
            {/* Poignée d'attrape (mobile) — clic = fermeture vers le bas. */}
            <div
              className="nc-profile-grabber"
              onClick={close}
              role="button"
              tabIndex={-1}
              aria-label="Fermer"
              data-fb-label="Poignée · Éditeur de profil"
            />
            <ProfileEditor onClose={close} />
          </div>
        </div>
      )}
    </ProfileModalContext.Provider>
  );
}
