"use client";

import { useEffect } from "react";

// ============================================================================
// KeyboardChromeWatcher — gère le chrome bas mobile pendant la saisie ET
// répare le viewport figé d'iOS PWA après fermeture du clavier.
//
// 1) `body.nc-typing` tant qu'un élément ÉDITABLE a le focus (clavier affiché).
//    Le CSS masque la BottomNav + le frost et resserre le shell communauté.
// 2) Variables viewport (`--nc-vvh`, `--nc-icb-drift`) mesurées PASSIVEMENT
//    via visualViewport — seule source fiable sur iOS (dvh/innerHeight peuvent
//    mentir, cf. plus bas).
// 3) RÉPARATION du bug WebKit des PWA standalone : après fermeture du clavier,
//    WebKit garde parfois des métriques de viewport FIGÉES à la taille
//    « clavier ouvert » (BottomNav remontée, page raccourcie, bande noire en
//    bas) jusqu'à un RELAYOUT MAJEUR — c'est pourquoi changer de page « répare ».
//    On détecte l'état figé (hauteur visible << hauteur de référence, clavier
//    fermé) et on force nous-mêmes ce relayout (toggle display synchrone du
//    body : aucun paint intermédiaire, donc aucun flash).
// 4) Fermeture du clavier PAR GESTE (swipe-down iOS) SANS blur : le champ garde
//    le focus → aucun focusout. On le détecte via la hauteur visible restaurée
//    pendant la saisie, et on blur() le champ pour sortir proprement du mode.
//
// Tout est en LECTURE de mesures + classes/variables CSS : aucun preventDefault,
// aucune interception du clavier → autofill et comportements natifs intacts.
// ============================================================================

const TYPING_CLASS = "nc-typing";

// Types d'<input> qui n'invoquent PAS de clavier texte.
const NON_TEXT_INPUT_TYPES = new Set([
  "button", "submit", "reset", "image", "checkbox", "radio",
  "range", "file", "color", "hidden",
]);

// Seuils (px) : un clavier fait ≥ ~260px — 120px distingue sans ambiguïté un
// clavier d'une variation de chrome ; 60px de tolérance pour « restauré ».
const KB_MIN = 120;
const RESTORED_TOLERANCE = 60;

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
    const root = document.documentElement;
    const vv = window.visualViewport;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    let blurConfirmTimer: ReturnType<typeof setTimeout> | null = null;
    const settleTimers: Array<ReturnType<typeof setTimeout>> = [];

    // Hauteur visible de référence (clavier FERMÉ), auto-calibrée : max observé
    // hors saisie. Réinitialisée quand la largeur change (rotation / resize
    // réel) pour ne pas comparer deux orientations.
    let baselineH = 0;
    let baselineW = 0;
    // Un clavier a-t-il été VU ouvert pendant la session de saisie en cours ?
    // (garde l'auto-blur : jamais déclenché au focus initial, ni avec un
    // clavier matériel qui n'affiche rien).
    let kbSeen = false;

    const visibleH = () => (vv ? vv.height + vv.offsetTop : window.innerHeight);

    // Relayout FORCÉ synchrone : display:none + flush + restore dans la même
    // frame → WebKit recalcule tout (ICB compris) sans jamais peindre l'état
    // intermédiaire. C'est l'équivalent programmatique du « switch de page qui
    // répare » constaté sur le viewport figé.
    const forceRelayout = () => {
      const prev = body.style.display;
      body.style.display = "none";
      void body.offsetHeight; // flush synchrone
      body.style.display = prev;
    };

    // Purge du scroll résiduel — uniquement sur les pages verrouillées au
    // viewport (tout scrollY y est un résidu iOS) ; jamais sur une page
    // scrollable (téléporterait l'utilisateur en haut).
    const purgeResidualScroll = () => {
      if (window.innerWidth >= 768) return;
      if (!document.querySelector(".nc-community-shell, .nc-coaching-shell")) return;
      window.scrollTo(0, 0);
    };

    const updateViewportVars = () => {
      if (!vv) return;
      root.style.setProperty("--nc-vvh", `${Math.round(vv.pageTop + vv.height)}px`);
      root.style.setProperty(
        "--nc-icb-drift",
        `${Math.max(0, Math.round(vv.height + vv.offsetTop - window.innerHeight))}px`,
      );
    };

    // Vérifie l'état FIGÉ (clavier fermé mais hauteur visible restée petite) et
    // le répare. Appelée en rafale après la sortie de saisie — le bug ne se
    // manifeste qu'à ce moment-là.
    const repairIfStuck = () => {
      if (window.innerWidth >= 768) return;
      purgeResidualScroll();
      updateViewportVars();
      if (baselineH > 0 && visibleH() < baselineH - KB_MIN) {
        forceRelayout();
        purgeResidualScroll();
        updateViewportVars();
      }
    };

    // Rafale de réparations après la fin de saisie : la fermeture du clavier
    // s'anime (~250 ms) et le figement peut n'apparaître qu'après — plusieurs
    // passes espacées couvrent aussi les événements manquants.
    const settleAfterTyping = () => {
      settleTimers.forEach(clearTimeout);
      settleTimers.length = 0;
      repairIfStuck();
      for (const delay of [120, 350, 700, 1200]) {
        settleTimers.push(setTimeout(repairIfStuck, delay));
      }
    };

    // Source de vérité du mode saisie : l'élément actuellement focus.
    const sync = () => {
      const typing = isEditable(document.activeElement);
      const wasTyping = body.classList.contains(TYPING_CLASS);
      body.classList.toggle(TYPING_CLASS, typing);
      if (wasTyping && !typing) {
        kbSeen = false;
        settleAfterTyping();
      }
    };

    const onFocusIn = () => {
      if (focusTimer) clearTimeout(focusTimer);
      sync();
    };
    // Différé : quand le focus passe d'un champ à un autre, focusout précède
    // focusin — sans ce délai, la classe (et la nav) clignoterait.
    const onFocusOut = () => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(sync, 60);
    };

    // Mesures continues + détections dépendantes du viewport.
    const onViewportChange = () => {
      updateViewportVars();

      const typing = body.classList.contains(TYPING_CLASS);
      const h = visibleH();

      // Calibrage de la référence (clavier fermé uniquement).
      if (window.innerWidth !== baselineW) {
        baselineW = window.innerWidth;
        baselineH = 0;
      }
      if (!typing && h > baselineH) baselineH = h;

      if (typing && baselineH > 0) {
        if (h < baselineH - KB_MIN) {
          // Clavier réellement visible pendant cette session de saisie.
          kbSeen = true;
          if (blurConfirmTimer) {
            clearTimeout(blurConfirmTimer);
            blurConfirmTimer = null;
          }
        } else if (kbSeen && h >= baselineH - RESTORED_TOLERANCE && !blurConfirmTimer) {
          // Clavier fermé AU GESTE (swipe-down iOS) : la hauteur visible est
          // revenue alors que le champ a TOUJOURS le focus (aucun focusout).
          // Confirmation différée (150 ms, re-mesure) puis blur() → on sort
          // proprement du mode saisie (nav restaurée, réparation lancée).
          blurConfirmTimer = setTimeout(() => {
            blurConfirmTimer = null;
            const active = document.activeElement;
            if (
              body.classList.contains(TYPING_CLASS) &&
              isEditable(active) &&
              visibleH() >= baselineH - RESTORED_TOLERANCE
            ) {
              (active as HTMLElement).blur();
            }
          }, 150);
        }
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    if (vv) {
      vv.addEventListener("resize", onViewportChange);
      vv.addEventListener("scroll", onViewportChange);
    }
    // innerHeight peut se restaurer TARDIVEMENT (dé-figement) sans événement
    // visualViewport → on ré-évalue aussi sur window.resize.
    window.addEventListener("resize", onViewportChange);
    sync();
    onViewportChange();

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (vv) {
        vv.removeEventListener("resize", onViewportChange);
        vv.removeEventListener("scroll", onViewportChange);
      }
      window.removeEventListener("resize", onViewportChange);
      if (focusTimer) clearTimeout(focusTimer);
      if (blurConfirmTimer) clearTimeout(blurConfirmTimer);
      settleTimers.forEach(clearTimeout);
      body.classList.remove(TYPING_CLASS);
      root.style.removeProperty("--nc-vvh");
      root.style.removeProperty("--nc-icb-drift");
    };
  }, []);

  return null;
}
