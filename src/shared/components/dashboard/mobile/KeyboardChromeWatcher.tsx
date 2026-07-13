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
    // (surtout en PWA standalone) → la page reste « remontée » (BottomNav
    // décalée vers le haut, carte rétrécie) jusqu'à une navigation. On remet le
    // scroll à zéro immédiatement PUIS après l'animation de fermeture (~350 ms),
    // le temps que le viewport ait réellement retrouvé sa taille.
    //
    // GARDE : uniquement mobile ET uniquement quand le document N'EST PAS censé
    // scroller (pages verrouillées au viewport : /communaute, /coaching — tout
    // scrollY y est un résidu). Sur une page scrollable (réglages, dashboard),
    // un scrollTo(0,0) au blur téléporterait l'utilisateur en haut de page.
    const purgeResidualScroll = () => {
      if (window.innerWidth >= 768) return;
      const doc = document.documentElement;
      if (doc.scrollHeight <= window.innerHeight + 1) {
        window.scrollTo(0, 0);
      }
    };
    const settleViewport = () => {
      purgeResidualScroll();
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        purgeResidualScroll();
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

    // ── Mesure PASSIVE du recouvrement clavier → variable CSS `--nc-kb` ─────
    // Sur iOS, `100dvh` ne se réduit PAS quand le clavier s'affiche (le clavier
    // RECOUVRE le layout viewport) → une hauteur en dvh laisse le bas de page
    // (composer) derrière le clavier. On expose donc le recouvrement réel
    // (layout viewport - visualViewport - défilement iOS) en variable CSS ; les
    // zones concernées (cf. .nc-messages-embed en globals.css) le soustraient
    // pour se caler au-dessus du clavier. Android : le layout viewport se
    // réduit nativement → recouvrement ≈ 0, la variable est neutre.
    // LECTURE SEULE (listeners passifs + setProperty) : aucun preventDefault,
    // aucun déplacement de focus → zéro impact sur l'autofill / le natif.
    const vv = window.visualViewport;
    let lastKb = 0;
    const updateKb = () => {
      if (!vv) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--nc-kb", `${Math.round(kb)}px`);
      // Retombée du clavier détectée côté viewport (couvre aussi la fermeture
      // par swipe-down iOS, qui NE blur PAS le champ → le chemin focusout ne
      // suffit pas) → même purge du décalage résiduel.
      if (lastKb > 40 && kb <= 1) settleViewport();
      lastKb = kb;
    };
    if (vv) {
      vv.addEventListener("resize", updateKb);
      vv.addEventListener("scroll", updateKb);
      updateKb();
    }

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (timer) clearTimeout(timer);
      if (settleTimer) clearTimeout(settleTimer);
      body.classList.remove(TYPING_CLASS);
      if (vv) {
        vv.removeEventListener("resize", updateKb);
        vv.removeEventListener("scroll", updateKb);
      }
      document.documentElement.style.removeProperty("--nc-kb");
    };
  }, []);

  return null;
}
