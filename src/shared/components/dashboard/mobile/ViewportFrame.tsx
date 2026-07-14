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
const KB_CLASS = "nc-kb-open";
// Compensation viewport standalone — PRÉ-CÂBLÉE, activée UNIQUEMENT via cette
// classe posée à la main par le bouton [COMP] de l'overlay debug (§1). Aucune
// activation auto dans ce commit : c'est un instrument de mesure.
const COMP_CLASS = "nc-vv-comp";
// Pinch-zoom : Safari ignore user-scalable=no. Hors échelle ~1, geler les
// variables (sinon le frame se réduit à la taille de la loupe → UI inutilisable).
const SCALE_EPS = 0.01;
// Un clavier logiciel fait ≥ ~250px ; 120 le sépare sans ambiguïté d'une simple
// variation de chrome. SEUL seuil d'hystérésis : « clavier présent » = réduction
// ≥ 120px, « clavier absent » = réduction < 120px. (Un KB_RESTORE=60 séparé
// ratait le retrait pour 2px en PWA, où vv.height ne remonte qu'à ~894 =
// clientHeight, pas 956 — cf. symptôme A.)
const KB_MIN = 120;
// Filet : au-delà, si aucune réduction n'a été vue, on démasque (clavier
// matériel Bluetooth, clavier flottant iPad, desktop en fenêtre étroite).
const NET_MS = 700;

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

export function ViewportFrame({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Verrou du canal `scrollY` (§1.2) : overflow:hidden sur html+body. Le canal
    // offsetTop, lui, n'est pas neutralisable — on le SUIT via le frame. GATÉ
    // MOBILE (le frame n'existe qu'en < 768px ; sur desktop le verrou violerait
    // le « diff nul »). Le franchissement du seuil en cours de session pose/
    // retire le verrou en conséquence. Les écritures --nc-vvh/--nc-vvot restent
    // inconditionnelles (inoffensives, frame en display:contents desktop).
    const mq = window.matchMedia("(max-width: 767px)");
    const applyLock = () => {
      root.classList.toggle(LOCK_CLASS, mq.matches);
    };
    applyLock();
    mq.addEventListener("change", applyLock);
    const unlock = () => {
      mq.removeEventListener("change", applyLock);
      root.classList.remove(LOCK_CLASS);
    };

    const vv = window.visualViewport;
    if (!vv) {
      // Sans visualViewport : le frame reste sur ses fallbacks CSS (100dvh, 0px).
      return unlock;
    }

    // Détection clavier (§1.5 : vv.height DÉTECTE, vv.offsetTop POSITIONNE).
    // baseline = plus grande hauteur observée HORS saisie, réinit. à la rotation.
    let baseline = 0;
    let baselineW = -1; // force la graine au 1er write
    // Max de hauteur observé PAR LARGEUR (§3) : dans l'état coincé, innerHeight
    // vaut 894 → une rotation A/R en état coincé écraserait 956 par 894 et
    // rendrait le déficit invisible. On mémorise le vrai max par largeur pour que
    // la graine reste fiable ; `if (h > baseline) baseline = h` apprend par-dessus.
    const maxByWidth = new Map<number, number>();
    // La compensation ne s'applique QU'en PWA installée (Safari Web est sain).
    const standaloneMq = window.matchMedia("(display-mode: standalone)");
    let sawKeyboard = false;
    let netTimer: ReturnType<typeof setTimeout> | null = null;
    const clearNet = () => {
      if (netTimer) { clearTimeout(netTimer); netTimer = null; }
    };

    // ── Verrou tactile du pan clavier-ouvert (symptôme C) ─────────────────────
    // overflow:hidden neutralise scrollY mais PAS le pan du viewport VISUEL
    // (canal non neutralisable en CSS, §1.2) → clavier ouvert, iOS laisse tirer
    // le fond au doigt et le frame suit avec 1 frame de retard = saccades. On
    // bloque le GESTE (pas le viewport, pas le focus, pas les variables) :
    // touchmove non-passif actif UNIQUEMENT tant que nc-kb-open est posée. On
    // laisse passer un geste qui scrolle réellement un conteneur interne dans sa
    // direction, OU qui part du champ éditable focus (jamais casser caret/
    // sélection) ; sinon preventDefault (dead zone / butée → pas de chaining
    // vers le pan). Amendement assumé à la liste noire : politique de GESTE
    // scopée à l'état clavier-ouvert, le positionnement reste en lecture seule.
    let touchStartTarget: Node | null = null;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartTarget = e.target as Node | null;
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!mq.matches || e.touches.length !== 1) return;
      const dy = (e.touches[0]?.clientY ?? 0) - touchStartY;
      const active = document.activeElement;
      let node: Node | null = touchStartTarget;
      while (node && node !== body) {
        // Chaîne contenant le champ éditable focus → toujours laisser passer.
        if (node === active) return;
        if (node instanceof HTMLElement) {
          const oy = getComputedStyle(node).overflowY;
          if (
            (oy === "auto" || oy === "scroll") &&
            node.scrollHeight > node.clientHeight
          ) {
            const max = node.scrollHeight - node.clientHeight;
            // doigt vers le bas (dy>0) → révèle le haut → scrollTop doit pouvoir
            // baisser ; doigt vers le haut (dy<0) → scrollTop doit pouvoir monter.
            if (dy > 0 && node.scrollTop > 0) return;
            if (dy < 0 && node.scrollTop < max) return;
            // Scrollable trouvé mais EN BUTÉE dans cette direction → on NE chaîne
            // PAS vers le pan du viewport (sinon le fond se retire) : blocage.
            break;
          }
        }
        node = node.parentNode;
      }
      e.preventDefault();
    };
    let touchAttached = false;
    const attachTouch = () => {
      if (touchAttached) return;
      touchAttached = true;
      document.addEventListener("touchstart", onTouchStart, { passive: true });
      document.addEventListener("touchmove", onTouchMove, { passive: false });
    };
    const detachTouch = () => {
      if (!touchAttached) return;
      touchAttached = false;
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };

    const removeKb = () => {
      clearNet();
      detachTouch();
      body.classList.remove(KB_CLASS);
    };
    const addKb = () => {
      if (body.classList.contains(KB_CLASS)) return;
      body.classList.add(KB_CLASS);
      attachTouch();
      sawKeyboard = false;
      clearNet();
      netTimer = setTimeout(() => {
        netTimer = null;
        if (!sawKeyboard) removeKb();
      }, NET_MS);
    };

    let rafId: number | null = null;
    const write = () => {
      rafId = null;
      // Garde pinch-zoom : geler les dernières valeurs saines hors échelle ~1.
      if (Math.abs(vv.scale - 1) > SCALE_EPS) return;

      const h = vv.height;
      // POSITIONNEMENT : offsetTop toujours BRUT (on SUIT le viewport, §1.5).
      root.style.setProperty("--nc-vvot", `${Math.round(vv.offsetTop)}px`);

      // baseline PAR LARGEUR (§3) : graine = max(innerHeight, max connu pour
      // cette largeur) — jamais 0 (sinon retrait mort à la rotation) et jamais
      // écrasée par 894 dans l'état coincé. `if (h > baseline) baseline = h`
      // apprend par-dessus ; on persiste le max par largeur.
      if (window.innerWidth !== baselineW) {
        baselineW = window.innerWidth;
        baseline = Math.max(window.innerHeight, maxByWidth.get(baselineW) ?? 0);
      }
      const kbClass = body.classList.contains(KB_CLASS);
      if (!kbClass) {
        if (h > baseline) {
          baseline = h;
        } else if (
          baseline > 0 &&
          h < baseline - KB_MIN &&
          isEditable(document.activeElement)
        ) {
          // Le clavier peut (ré)apparaître SANS focusin : re-tap d'un champ
          // DÉJÀ focus après un swipe-down. Le focusin sert l'ANTICIPATION ; la
          // hauteur reste la VÉRITÉ. Classe posée directement (pas via addKb()).
          body.classList.add(KB_CLASS);
          attachTouch();
          sawKeyboard = true;
          clearNet();
        }
        maxByWidth.set(baselineW, baseline);
      } else if (baseline > 0) {
        if (h < baseline - KB_MIN) {
          // Clavier réellement présent pendant cette session de saisie.
          sawKeyboard = true;
        } else if (sawKeyboard && h > baseline - KB_MIN) {
          // Réduction repassée SOUS le seuil → clavier fermé (bouton OU
          // swipe-down). Marge 120px : en PWA vv.height ne remonte qu'à ~894.
          removeKb();
        }
      }

      // HAUTEUR du frame. Défaut = vv.height BRUT (la détection ci-dessus a lu h
      // brut ; la compensation ne pollue JAMAIS la détection, §1.5 étendu).
      // COMPENSATION (debug, INACTIVE par défaut — activée par body.nc-vv-comp) :
      // en PWA, après une session clavier, le WEBVIEW se rétrécit de ~62px et vv
      // reste cohérent avec l'ICB coincé → « état déficit ». On réécrit alors
      // --nc-vvh = baseline (hauteur pleine) pour rendre le vrai bas d'écran.
      // Bornes : standalone ET classe absente ET 0 < baseline − h < KB_MIN
      // (62 ∈ ]0,120[ ; un clavier fait ≥ ~350px ET pose la classe → jamais dans
      // ces bornes).
      const deficit =
        standaloneMq.matches &&
        !kbClass &&
        baseline > 0 &&
        h < baseline &&
        baseline - h < KB_MIN;
      const compEnabled = body.classList.contains(COMP_CLASS);
      root.style.setProperty(
        "--nc-vvh",
        `${Math.round(compEnabled && deficit ? baseline : h)}px`,
      );
      // Expose baseline pour l'overlay debug — retiré en Phase 6 avec l'overlay.
      root.style.setProperty("--nc-vvbase", `${Math.round(baseline)}px`);
    };
    // Écriture COALESCÉE : au plus une par frame (resize + scroll peuvent tirer
    // plusieurs events par frame → un seul rAF planifié).
    const schedule = () => {
      if (rafId == null) rafId = requestAnimationFrame(write);
    };

    // Masquer la nav DÈS le focus (anticipation = transition fluide), avant même
    // que le clavier monte.
    const onFocusIn = () => {
      if (isEditable(document.activeElement)) addKb();
      schedule();
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    document.addEventListener("focusin", onFocusIn);
    // Le bouton [COMP] de l'overlay (debug) toggle body.nc-vv-comp SANS event
    // viewport → il émet aussi nc-vv-recompute pour forcer un recalcul immédiat.
    window.addEventListener("nc-vv-recompute", schedule);
    write(); // valeur initiale synchrone

    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("nc-vv-recompute", schedule);
      if (rafId != null) cancelAnimationFrame(rafId);
      clearNet();
      detachTouch();
      body.classList.remove(KB_CLASS);
      unlock();
      root.style.removeProperty("--nc-vvh");
      root.style.removeProperty("--nc-vvot");
      root.style.removeProperty("--nc-vvbase");
    };
  }, []);

  return <div className="nc-vv-frame">{children}</div>;
}
