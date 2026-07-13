"use client";

import { useEffect } from "react";

// Suit le clavier logiciel mobile via l'API VisualViewport et expose son état
// au CSS, SANS state React (donc sans re-render ni set-state-in-effect) :
//   • `--nc-vvh` sur :root = hauteur RÉELLEMENT visible (au-dessus du clavier),
//     fiable sur iOS comme Android — sert de base de hauteur aux zones qui
//     doivent se caler au-dessus du clavier (cf. .nc-messages-embed).
//   • `body.nc-keyboard-open` = vrai dès que le clavier occupe une hauteur
//     significative → permet de masquer la BottomNav et d'activer les overrides
//     de hauteur (cf. globals.css).
//
// À monter dans les vues à saisie qui doivent réagir au clavier (messagerie).
// Le nettoyage retire la classe et la variable au démontage. No-op si
// VisualViewport n'existe pas (vieux navigateurs, SSR) — dégradation propre.
//
// Seuil : 80px pour distinguer l'ouverture du clavier des petites variations de
// hauteur (barre d'URL qui se replie, etc.).
const KEYBOARD_THRESHOLD_PX = 80;

export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    const root = document.documentElement;
    const body = document.body;

    const update = () => {
      root.style.setProperty("--nc-vvh", `${Math.round(vv.height)}px`);
      // Hauteur du clavier = espace de la fenêtre de mise en page non couvert
      // par le visualViewport (offsetTop couvre le cas d'un défilement partiel).
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      body.classList.toggle("nc-keyboard-open", keyboard > KEYBOARD_THRESHOLD_PX);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      body.classList.remove("nc-keyboard-open");
      root.style.removeProperty("--nc-vvh");
    };
  }, []);
}
