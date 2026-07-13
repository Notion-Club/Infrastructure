"use client";

import { useEffect } from "react";

// ============================================================================
// KeyboardChromeWatcher — masque le chrome bas mobile pendant la saisie.
//
// Pose `body.nc-typing` tant qu'un élément ÉDITABLE (input texte, textarea,
// contenteditable) a le focus — c'est-à-dire tant que le clavier logiciel est
// affiché sur mobile. Le CSS (globals.css) s'appuie dessus pour masquer la
// BottomNav ET le frost de bas d'écran (.nc-pwa-bottom-frost), et pour redonner
// la hauteur récupérée à la zone messages.
//
// Pourquoi focusin/focusout AU NIVEAU DOCUMENT (et pas un onFocus posé sur un
// champ précis) : le clavier peut être invoqué par N champs (composer de
// message, édition inline d'une bulle, barre de recherche…). Écouter le
// document couvre tous les cas présents et futurs sans câblage individuel.
//
// Pourquoi PAS l'API VisualViewport : intercepter le viewport/clavier s'est
// montré invasif (cf. revert du hook useKeyboardInset — perte d'affordances
// natives). Ici on ne touche à AUCUNE API clavier : simple classe CSS calée
// sur le focus, comportements natifs (autofill, scroll-into-view) intacts.
//
// Le focusout est différé (60 ms) : quand le focus passe d'un champ à un autre,
// focusout précède focusin — sans ce délai, la classe clignoterait (nav qui
// flashe entre deux champs).
// ============================================================================

const TYPING_CLASS = "nc-typing";

// Types d'<input> qui n'invoquent PAS de clavier texte.
const NON_TEXT_INPUT_TYPES = new Set([
  "button", "submit", "reset", "image", "checkbox", "radio",
  "range", "file", "color", "hidden",
]);

function isEditable(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  }
  return false;
}

export function KeyboardChromeWatcher() {
  useEffect(() => {
    const body = document.body;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    // Purge du DÉCALAGE RÉSIDUEL laissé par iOS après fermeture du clavier :
    // pendant la saisie, WebKit scrolle/décale le viewport pour garder le champ
    // visible, et il arrive qu'il ne restaure PAS cette position à la fermeture
    // (surtout en PWA standalone) → la page reste « remontée » jusqu'à une
    // navigation. On remet le scroll à zéro immédiatement PUIS après
    // l'animation de fermeture (~350 ms), et on re-mesure les variables
    // viewport (cf. updateViewportVars) au même rythme.
    //
    // GARDE : uniquement mobile ET uniquement sur les pages VERROUILLÉES au
    // viewport (/communaute, /coaching — tout scrollY y est un résidu). Sur une
    // page scrollable (réglages, dashboard), un scrollTo(0,0) au blur
    // téléporterait l'utilisateur en haut de page.
    const purgeResidualScroll = () => {
      if (window.innerWidth >= 768) return;
      if (!document.querySelector(".nc-community-shell, .nc-coaching-shell")) return;
      window.scrollTo(0, 0);
    };
    const settleViewport = () => {
      purgeResidualScroll();
      updateViewportVars();
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        purgeResidualScroll();
        updateViewportVars();
        settleTimer = null;
      }, 350);
    };

    // Source de vérité unique : l'élément actuellement focus. Idempotent →
    // safe à rappeler sur chaque événement. À la SORTIE de saisie, on purge le
    // décalage résiduel du viewport (cf. settleViewport).
    const sync = () => {
      const typing = isEditable(document.activeElement);
      const wasTyping = body.classList.contains(TYPING_CLASS);
      body.classList.toggle(TYPING_CLASS, typing);
      if (wasTyping && !typing) settleViewport();
    };

    const onFocusIn = () => {
      if (timer) clearTimeout(timer);
      sync();
    };
    const onFocusOut = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sync, 60);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    sync();

    // ── Mesure PASSIVE du viewport RÉEL → variables CSS ─────────────────────
    // Le visualViewport est la SEULE source fiable sur iOS : `100dvh` ne se
    // réduit pas quand le clavier s'affiche (Safari : le clavier RECOUVRE la
    // page), et pire, en PWA standalone le layout viewport peut rester FIGÉ à
    // la taille « clavier ouvert » après fermeture (bug WebKit) → BottomNav
    // (fixed bottom) remontée + 100dvh trop petit jusqu'à une navigation. On
    // expose donc :
    //   • `--nc-vvh` = bas de la zone réellement visible en coordonnées
    //     document (pageTop + height) → hauteur des shells verrouillés
    //     (.nc-community-shell), insensible au dvh/ICB figés ;
    //   • `--nc-icb-drift` = de combien le layout viewport figé est PLUS COURT
    //     que le viewport réel → translation corrective des éléments fixed
    //     ancrés en bas (BottomNav, frost), qui suivent l'ICB figé.
    // LECTURE SEULE (listeners passifs + setProperty) : aucun preventDefault,
    // aucun déplacement de focus → zéro impact sur l'autofill / le natif.
    const vv = window.visualViewport;
    let lastKb = 0;
    function updateViewportVars() {
      if (!vv) return;
      const root = document.documentElement;
      root.style.setProperty(
        "--nc-vvh",
        `${Math.round(vv.pageTop + vv.height)}px`,
      );
      root.style.setProperty(
        "--nc-icb-drift",
        `${Math.max(0, Math.round(vv.height + vv.offsetTop - window.innerHeight))}px`,
      );
      // Retombée du clavier détectée côté viewport (couvre la fermeture par
      // swipe-down iOS, qui NE blur PAS le champ → le chemin focusout ne
      // suffit pas) → purge du décalage résiduel + re-mesure différée.
      // `lastKb` est mis à jour AVANT le déclenchement : settleViewport
      // rappelle updateViewportVars, le garde évite toute récursion.
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const wasKb = lastKb;
      lastKb = kb;
      if (wasKb > 40 && kb <= 1) settleViewport();
    }
    if (vv) {
      vv.addEventListener("resize", updateViewportVars);
      vv.addEventListener("scroll", updateViewportVars);
      // innerHeight peut se restaurer TARDIVEMENT (dé-figement de l'ICB) sans
      // événement visualViewport → on ré-évalue aussi sur window.resize.
      window.addEventListener("resize", updateViewportVars);
      updateViewportVars();
    }

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (timer) clearTimeout(timer);
      if (settleTimer) clearTimeout(settleTimer);
      body.classList.remove(TYPING_CLASS);
      if (vv) {
        vv.removeEventListener("resize", updateViewportVars);
        vv.removeEventListener("scroll", updateViewportVars);
        window.removeEventListener("resize", updateViewportVars);
      }
      document.documentElement.style.removeProperty("--nc-vvh");
      document.documentElement.style.removeProperty("--nc-icb-drift");
    };
  }, []);

  return null;
}
