"use client";

import { useEffect, type ReactNode } from "react";

// ============================================================================
// ViewportFrame — le « frame qui suit le viewport visuel » (chantier v2).
//
// Monté UNIQUEMENT dans le layout /communaute. Il rend un conteneur
// `.nc-vv-frame` (cf. globals.css) maintenu, sur mobile, en superposition
// EXACTE de la zone réellement visible via deux variables CSS que ce composant
// met à jour à chaque frame :
//
//   --nc-vvh   = Math.round(visualViewport.height)     → hauteur du frame
//   --nc-vvot  = Math.round(visualViewport.offsetTop)  → translateY du frame
//
// WebKit ne redimensionne PAS le layout au clavier (interactive-widget absent,
// bug 259770) : il RECOUVRE la page et décale le viewport visuel (offsetTop).
// On ne combat pas ce décalage (impossible), on le SUIT : le frame se recale
// dessus image par image → la zone visible et le frame coïncident toujours,
// clavier ouvert, fermé, ou dans l'état bogué où offsetTop reste coincé > 0.
//
// RÈGLE (§1.5) : vv.height DÉTECTE le clavier (Phase 3), vv.offsetTop POSITIONNE
// le frame. Les deux usages sont distincts.
//
// Le `transform` du frame crée un CONTAINING BLOCK : tous les `position: fixed`
// descendants (BottomNav, actions, frost…) se résolvent contre le frame =
// contre la zone visible réelle, plus contre l'ICB corrompu (§2.1).
//
// Lecture seule : aucun blur/preventDefault/scrollTo/setTimeout.
// ============================================================================

const LOCK_CLASS = "nc-vv-lock";
// Pinch-zoom : Safari ignore user-scalable=no. Hors échelle ~1, geler les
// variables (sinon le frame se réduit à la taille de la loupe → UI inutilisable).
const SCALE_EPS = 0.01;

export function ViewportFrame({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;

    // Verrou du canal `scrollY` (§1.2) : overflow:hidden sur html+body. Le canal
    // offsetTop, lui, n'est pas neutralisable — on le SUIT via le frame.
    root.classList.add(LOCK_CLASS);

    const vv = window.visualViewport;
    if (!vv) {
      // Sans visualViewport : le frame reste sur ses fallbacks CSS (100dvh, 0px).
      return () => root.classList.remove(LOCK_CLASS);
    }

    let rafId: number | null = null;
    const write = () => {
      rafId = null;
      // Garde pinch-zoom : geler les dernières valeurs saines hors échelle ~1.
      if (Math.abs(vv.scale - 1) > SCALE_EPS) return;
      root.style.setProperty("--nc-vvh", `${Math.round(vv.height)}px`);
      root.style.setProperty("--nc-vvot", `${Math.round(vv.offsetTop)}px`);
    };
    // Écriture COALESCÉE : au plus une par frame (resize + scroll peuvent tirer
    // plusieurs events par frame → un seul rAF planifié).
    const schedule = () => {
      if (rafId == null) rafId = requestAnimationFrame(write);
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    write(); // valeur initiale synchrone

    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (rafId != null) cancelAnimationFrame(rafId);
      root.classList.remove(LOCK_CLASS);
      root.style.removeProperty("--nc-vvh");
      root.style.removeProperty("--nc-vvot");
    };
  }, []);

  return <div className="nc-vv-frame">{children}</div>;
}
