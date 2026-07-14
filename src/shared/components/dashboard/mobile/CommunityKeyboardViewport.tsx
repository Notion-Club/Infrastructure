"use client";

import { useEffect } from "react";

// ============================================================================
// CommunityKeyboardViewport — dimensionnement de la carte /communaute au clavier.
//
// REMPLACE l'ancien ViewportFrame (340 l.) : ce dernier suivait le viewport via
// un conteneur `position: fixed` + `transform` couvrant l'écran → il reflowait la
// safe-area iOS et DÉPLAÇAIT la BottomNav globale (bloquée trop haut en PWA, vide
// en dessous). Voir docs/community-keyboard-viewport §5.E.
//
// Ici : AUCUN `position: fixed`, AUCUN transform, AUCUN wrap du chrome. On agit
// uniquement via deux signaux GLOBAUX en lecture seule :
//   1. `body.nc-kb-open` — clavier actif → la BottomNav est masquée (CSS pur) et
//      le padding bas du shell tombe à 8px (composer au ras du clavier).
//   2. `--nc-vvh` — hauteur du viewport VISIBLE, posée UNIQUEMENT clavier ouvert.
//      Le shell `/communaute` a `height: var(--nc-vvh, 100dvh)` → il rétrécit
//      avec le clavier, la carte (flex) et le composer restent visibles en entier
//      (fin du « composant qui remonte, haut masqué »). Au repos la variable est
//      RETIRÉE → fallback 100dvh : robuste contre le getter `vv.height` qui reste
//      figé à ~894 en PWA après fermeture du clavier (il ne réémet pas d'event).
//
// La nav n'étant JAMAIS touchée en position (aucun frame), elle reste identique à
// /accueil sur toutes les routes — le bug de position disparaît par construction.
//
// Monté UNIQUEMENT dans le layout /communaute.
// ============================================================================

// Un clavier logiciel fait ≥ ~250px ; 120 le sépare sans ambiguïté d'une simple
// variation de chrome. Seuil d'hystérésis unique (pose ET retrait) : en PWA
// vv.height ne remonte qu'à ~894 (= clientHeight) et non 956 à la fermeture →
// un seuil de retrait plus fin raterait le démasquage.
const KB_MIN = 120;
// Filet : si aucune réduction n'est vue (clavier matériel / flottant iPad), on
// démasque après ce délai pour ne pas rester bloqué « clavier ouvert ».
const NET_MS = 700;
// Pinch-zoom : Safari ignore user-scalable=no. Hors échelle ~1, on gèle les
// valeurs (sinon --nc-vvh suivrait la loupe → UI cassée).
const SCALE_EPS = 0.01;

const NON_TEXT_INPUT = new Set([
  "button", "submit", "reset", "image", "checkbox", "radio",
  "range", "file", "color", "hidden",
]);
function isEditable(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    return !NON_TEXT_INPUT.has((el as HTMLInputElement).type);
  }
  return false;
}

export function CommunityKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const body = document.body;
    if (!vv) return; // sans visualViewport, le shell reste sur son fallback 100dvh

    // baseline = plus grande hauteur observée HORS saisie, PAR LARGEUR (§3 du doc :
    // dans l'état iOS « coincé », innerHeight vaut 894 → une rotation écraserait le
    // vrai 956 ; on mémorise le max par largeur pour garder une graine fiable).
    let baseline = 0;
    let baselineW = -1;
    const maxByWidth = new Map<number, number>();
    let sawKeyboard = false;
    let netTimer: ReturnType<typeof setTimeout> | null = null;
    const clearNet = () => {
      if (netTimer) { clearTimeout(netTimer); netTimer = null; }
    };

    // NB : après fermeture du clavier en PWA iOS, WebKit CONTRACTE le layout
    // viewport par le bas (100dvh 956→894) et ne le restaure jamais. On ne tente
    // PLUS de le dé-figer en JS (relayout forcé / scrollTo : inefficaces, mesuré).
    // La BottomNav ET le shell compensent cette contraction en CSS via
    // `(100lvh − 100dvh)` (100lvh, lui, ne se contracte pas) — cf. globals.css.
    // Ici on ne pilote donc QUE le clavier (nav masquée + shell rétréci au ras).

    const closeKb = () => {
      clearNet();
      body.classList.remove("nc-kb-open");
      // Retrait de --nc-vvh / --nc-vvot → le shell reprend son fallback (100lvh en
      // PWA) et sa translation revient à 0.
      root.style.removeProperty("--nc-vvh");
      root.style.removeProperty("--nc-vvot");
    };
    const openKbAnticipate = () => {
      if (body.classList.contains("nc-kb-open")) return;
      body.classList.add("nc-kb-open");
      sawKeyboard = false;
      clearNet();
      netTimer = setTimeout(() => {
        netTimer = null;
        if (!sawKeyboard) closeKb(); // clavier jamais vu → on annule (matériel)
      }, NET_MS);
    };

    // Verrou de scroll du DOCUMENT, clavier ouvert. Le shell est translaté de
    // --nc-vvot (translateY) pour suivre le pan du viewport visuel iOS : ce
    // transform crée une zone de débordement que WebKit laisse PANER au doigt
    // (l'`overflow: hidden` CSS sur html/body n'est PAS respecté par iOS dans ce
    // cas). Résultat : le « fond de page » scrollait derrière la carte. On
    // ré-épingle donc le scroll du document à 0 tant que le clavier est CONFIRMÉ
    // (sawKeyboard). Comme le composer reste visible via le translateY du shell,
    // forcer scrollY=0 ne cache jamais le champ. Gate sawKeyboard → JAMAIS actif
    // sur desktop (scroll-document légitime) ni pendant la fenêtre d'anticipation.
    const pinScroll = () => {
      if (!sawKeyboard || !body.classList.contains("nc-kb-open")) return;
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      // Selon le webview, l'élément scrollant est window OU documentElement.
      const se = document.scrollingElement as HTMLElement | null;
      if (se && se.scrollTop !== 0) se.scrollTop = 0;
    };

    let raf: number | null = null;
    const write = () => {
      raf = null;
      if (Math.abs(vv.scale - 1) > SCALE_EPS) return; // gèle en pinch-zoom
      const h = vv.height;

      if (window.innerWidth !== baselineW) {
        baselineW = window.innerWidth;
        baseline = Math.max(window.innerHeight, maxByWidth.get(baselineW) ?? 0);
      }

      const kb = body.classList.contains("nc-kb-open");
      if (!kb) {
        if (h > baseline) {
          baseline = h;
        } else if (
          baseline > 0 &&
          h < baseline - KB_MIN &&
          isEditable(document.activeElement)
        ) {
          // Le clavier peut (ré)apparaître SANS focusin (re-tap d'un champ déjà
          // focus après swipe-down) : la hauteur est la vérité.
          body.classList.add("nc-kb-open");
          sawKeyboard = true;
          clearNet();
        }
        maxByWidth.set(baselineW, baseline);
      } else if (baseline > 0) {
        if (h < baseline - KB_MIN) {
          sawKeyboard = true;
        } else if (sawKeyboard && h > baseline - KB_MIN) {
          // Réduction repassée sous le seuil → clavier fermé (bouton ou swipe-down).
          closeKb();
          return;
        }
      }

      // Clavier ouvert : on pose la géométrie du viewport VISIBLE, que le shell
      // suit (height + translateY) pour rester calé dans la zone visible.
      //  • --nc-vvh  = hauteur visible → le shell rétrécit dessus ;
      //  • --nc-vvot = offsetTop du visual viewport → iOS « pan » le viewport pour
      //    remonter le champ ; sans le suivre, le shell flotte vers le haut et
      //    laisse un vide en dessous. On translate le shell de cette valeur pour
      //    qu'il colle EXACTEMENT à la zone visible (haut du fil ↔ bas au ras du
      //    clavier). translateY sur un élément NON-fixed → n'affecte pas la nav
      //    (sœur, pas descendante) ni la safe-area.
      if (body.classList.contains("nc-kb-open")) {
        root.style.setProperty("--nc-vvh", `${Math.round(h)}px`);
        root.style.setProperty("--nc-vvot", `${Math.round(vv.offsetTop)}px`);
        // Re-verrouille le scroll du document à chaque frame (le listener scroll
        // ci-dessous couvre les drags entre deux frames).
        pinScroll();
      }
    };
    // Coalescé : au plus une écriture par frame.
    const schedule = () => {
      if (raf == null) raf = requestAnimationFrame(write);
    };

    // Anticipation : masquer la nav dès le focus (avant même que le clavier monte).
    const onFocusIn = () => {
      if (isEditable(document.activeElement)) openKbAnticipate();
      schedule();
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    document.addEventListener("focusin", onFocusIn);
    // Verrou de scroll : rattrape tout drag du fond entre deux frames rAF.
    window.addEventListener("scroll", pinScroll, { passive: true });
    // Resync au retour premier plan / bfcache (le rAF a pu être gelé).
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", schedule);
    write();

    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("scroll", pinScroll);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("visibilitychange", schedule);
      if (raf != null) cancelAnimationFrame(raf);
      clearNet();
      body.classList.remove("nc-kb-open");
      root.style.removeProperty("--nc-vvh");
      root.style.removeProperty("--nc-vvot");
    };
  }, []);

  return null;
}
