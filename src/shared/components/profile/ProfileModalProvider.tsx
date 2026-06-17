"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { ProfileEditor } from "./ProfileEditor";

// ============================================================================
// ProfileModalProvider (#128) — ouvre l'éditeur de profil public depuis
// n'importe où (menu compte de la Topbar / MobileTopActions, recap dans
// /settings).
//
// Rendu : modale centrée sur desktop, interface pleine page sur mobile
// (cf. classes `.nc-profile-*` dans globals.css).
//
// Monté dans (app)/layout.tsx, donc HORS de tout `nc-page-halo`
// (isolation: isolate) : la racine en `position: fixed` n'est jamais cassée
// par un filtre/isolation d'ancêtre.
// ============================================================================

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
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Lock du scroll de fond + fermeture clavier (Escape) quand la modale est
  // ouverte.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <ProfileModalContext.Provider value={{ isOpen, open, close }}>
      {children}
      {isOpen && (
        <div
          className="nc-profile-modal-root"
          role="dialog"
          aria-modal="true"
          aria-label="Mon profil"
        >
          {/* Backdrop — visible surtout en desktop (modale centrée). Sur
              mobile le panneau est full-bleed et le recouvre. Clic = fermer. */}
          <div
            className="nc-profile-backdrop"
            onClick={close}
            aria-hidden
          />
          <div className="nc-profile-panel" data-fb-label="Éditeur de profil">
            <ProfileEditor onClose={close} />
          </div>
        </div>
      )}
    </ProfileModalContext.Provider>
  );
}
