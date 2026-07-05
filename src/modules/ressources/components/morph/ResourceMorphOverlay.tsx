'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { ResourceBadge } from '../shared/ResourceBadge';
import { CapabilityLock } from '../shared/CapabilityLock';
import { TellaEmbed } from '../shared/TellaEmbed';
import { ResourceContentBody } from '../shared/ResourceContentBody';
import { canAccess } from '../../lib/access';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { getResourceBody } from '../../server/getResourceBody';
import type { Resource, Template, NotionBlock } from '../../types';
import { SPRING_EASING, SPRING_DURATION } from '../../lib/spring';
import type { MorphSource } from './MorphSourceContext';

// Morph WAAPI (mécanique validée au lab v9) — surface clippée qui morphe (coins
// lisses), titre CONTINU (hero) qui voyage, fade-through à gap des contenus.
//
// SCROLL DOCUMENT : l'encadré n'a PAS de hauteur figée — il fait la longueur de
// son contenu et défile dans un conteneur de scroll plein écran (pas de scroll
// INTERNE). Pendant le morph la surface est `position: fixed` (géométrie pilotée
// au pixel, mécanique inchangée) ; à la fin de l'ouverture elle est RELÂCHÉE en
// flux (`position: relative`) dans le conteneur → le contenu défile, le titre
// défile avec lui, et la croix reste FIXE à l'écran.

const FADE = 'linear';

const H1_STYLE: CSSProperties = {
  fontSize: 'clamp(30px, 5vw, 46px)',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: 'var(--color-text-primary)',
  margin: 0,
  lineHeight: 1.12,
  paddingRight: 48, // dégage la croix
  boxSizing: 'border-box',
};
const CARD_TITLE_STYLE: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  margin: 0,
  lineHeight: 1.4,
};

// Décalage haut de l'encadré (safe-area + marge) — partagé surfWrap / mesures.
const TOP_OFFSET = 'calc(env(safe-area-inset-top, 0px) + 76px)';
const SURF_WIDTH = 'min(720px, calc(100vw - 32px))';

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// Bouton « Dupliquer ce template » — inline pour respecter l'isolation modules
// (le composant d'origine vit sous src/app/, hors périmètre importable).
const NotionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <rect width="100" height="100" rx="14" fill="black" />
    <path d="M24 20h52v8L48 72H76v8H24v-8l28-44H24V20z" fill="white" />
  </svg>
);
function DuplicateButton({ url }: { url: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, marginTop: 24 }}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderRadius: 9999, background: 'var(--nc-btn-dark-bg)', color: 'var(--nc-btn-dark-text)', fontSize: 15, fontWeight: 600, textDecoration: 'none', transition: 'opacity 150ms ease' }} className="hover:opacity-80">
        <NotionIcon />
        Dupliquer ce template
      </a>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
        Ouvre la page Notion publique du template. Clique sur &ldquo;Dupliquer&rdquo; en haut à droite pour l&rsquo;ajouter à ton espace.
      </p>
    </div>
  );
}

// Skeleton du corps Notion, affiché le temps que la Server Action charge le
// body (l'overlay s'ouvre avant que le contenu soit prêt). Réutilise le
// keyframe global `nc-skeleton-pulse`.
function ResourceBodySkeleton() {
  const pulse: CSSProperties = {
    animation: 'nc-skeleton-pulse 1.6s ease-in-out infinite',
    background: 'var(--color-surface-raised)',
    borderRadius: 8,
  };
  return (
    <>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: '28px 0' }} />
      {['96%', '88%', '92%', '70%', '82%'].map((w, i) => (
        <div key={w} style={{ ...pulse, height: 14, width: w, marginTop: i === 0 ? 0 : 12 }} />
      ))}
    </>
  );
}

const anim = (el: Element | null, kf: Keyframe[], duration: number, easing: string, store: Animation[]): Animation | null => {
  if (!el) return null;
  const a = el.animate(kf, { duration, easing, fill: 'both' });
  store.push(a);
  return a;
};

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
// Éléments focusables visibles à l'intérieur de la surface (pour le focus-trap).
function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  );
}

interface MorphGeom {
  surfFrom: Keyframe;
  surfTo: Keyframe;
  heroFrom: string;
  // Géométrie fixe (viewport, scroll 0) pour ré-ancrer la surface à la fermeture.
  fixTop: number;
  fixLeft: number;
  fixW: number;
  openH: number;
  heroTop: number;
  heroLeft: number;
  heroW: number;
}

interface OverlayProps {
  source: MorphSource;
  /** Appelé UNE fois l'animation de fermeture terminée → le provider démonte. */
  onClose: () => void;
}

export function ResourceMorphOverlay({ source, onClose }: OverlayProps) {
  const item = source.item;
  const isResource = item.category === 'resource';
  const resource = isResource ? (item as Resource) : null;
  const template = isResource ? null : (item as Template);
  const hasAccess = canAccess(mockCurrentUser.capability, item.visibilite);

  const pageBgRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<HTMLDivElement>(null);
  const encRef = useRef<HTMLDivElement>(null);
  const encTitleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardTitleRef = useRef<HTMLHeadingElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null);

  const gRef = useRef<MorphGeom | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const closingRef = useRef(false);
  const poppedRef = useRef(false);
  const [interactive, setInteractive] = useState(false);

  // Corps Notion de la ressource. La carte ne le fournit pas (liste = body vide)
  // → on le charge via la Server Action à l'ouverture. `null` = en cours de
  // chargement (skeleton) ; un tableau = chargé (corps OU [] si verrouillé/vide).
  const [body, setBody] = useState<NotionBlock[] | null>(
    () => (resource && resource.content.length > 0 ? resource.content : null),
  );
  const bodyFetchedRef = useRef(false);
  useEffect(() => {
    if (!resource || !hasAccess) return; // verrouillé → CapabilityLock, pas de fetch
    if (resource.content.length > 0) return; // déjà fourni
    if (bodyFetchedRef.current) return;
    bodyFetchedRef.current = true;
    let alive = true;
    getResourceBody(resource.slug)
      .then((blocks) => {
        if (alive) setBody(blocks);
      })
      .catch(() => {
        if (alive) setBody([]);
      });
    return () => {
      alive = false;
    };
  }, [resource, hasAccess]);

  // Apparition du contenu (skeleton → contenu réel) : redimensionnement FLUIDE de
  // la carte (skill 01-card-resize) + reveal du corps (skill 18-texts-reveal).
  // Ne joue que pour le chargement ASYNC (corps absent au départ) ; en synchrone
  // le morph révèle déjà tout.
  // Corps chargé en ASYNC (absent au départ) ? Stable pour l'instance (key=slug).
  const startedEmpty = !!resource && hasAccess && resource.content.length === 0;
  const [reduced] = useState(prefersReduced);
  const [contentIn, setContentIn] = useState(false);
  const skelHRef = useRef<number | null>(null);

  // Mémorise la hauteur du skeleton tant que le corps n'est pas arrivé.
  useLayoutEffect(() => {
    if (body === null && surfRef.current) skelHRef.current = surfRef.current.offsetHeight;
  });

  // À l'arrivée du corps (post-ouverture) : tween de la hauteur skeleton → contenu.
  useLayoutEffect(() => {
    if (body === null || !interactive) return;
    const surf = surfRef.current;
    const oldH = skelHRef.current;
    if (surf && oldH != null && startedEmpty && !reduced) {
      const newH = surf.offsetHeight;
      if (Math.abs(newH - oldH) > 4) {
        surf.animate([{ height: `${oldH}px` }, { height: `${newH}px` }], { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
    skelHRef.current = null;
  }, [body, interactive, reduced, startedEmpty]);

  // Déclenche le reveal du corps une fois la carte redimensionnée (double rAF).
  // Uniquement quand le reveal est ACTIF (corps async + motion autorisé) ; sinon
  // le style de reveal n'est pas appliqué et `contentIn` n'a aucun effet.
  useEffect(() => {
    if (body === null || !interactive || !startedEmpty || reduced) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setContentIn(true)));
    return () => cancelAnimationFrame(id);
  }, [body, interactive, reduced, startedEmpty]);

  // Fin de fermeture : retire notre entrée d'historique (si fermeture manuelle,
  // pas via le bouton « retour »), puis demande le démontage au provider.
  const finishClose = useCallback(() => {
    if (!poppedRef.current) {
      try {
        window.history.back();
      } catch {
        /* noop */
      }
    }
    // Restitue le focus à la carte UNIQUEMENT si l'ouverture était au clavier.
    // En tactile/souris, refocaliser la carte affiche un encadré bleu de sélection
    // iOS au moment de la fermeture → on s'en abstient. preventScroll : pas de saut.
    if (source.viaKeyboard) {
      try {
        source.triggerEl?.focus?.({ preventScroll: true });
      } catch {
        /* noop */
      }
    }
    onClose();
  }, [onClose, source]);

  // ── Fermeture (ré-ancre la surface en fixed, joue le morph inverse) ─────────
  const startClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setInteractive(false);

    const g = gRef.current;
    const surf = surfRef.current;
    if (!g || !surf || prefersReduced()) return finishClose();

    // Dé-piège la surface AVANT de la ré-ancrer, SYNCHRONEMENT. En PWA iOS un
    // `position: fixed` descendant d'un scroller `-webkit-overflow-scrolling:touch`
    // s'ancre au CONTENU du scroller (pas au viewport) → si l'utilisateur avait
    // scrollé de S, la surface ré-ancrée partait à `fixTop − S` (hors écran) et le
    // rétrécissement jouait invisible (« fermeture brutale »). #258 figeait bien
    // `overflow:hidden` mais ça ne suffit pas :
    //   1. le layer « momentum » (`-webkit-overflow-scrolling:touch`) reste actif —
    //      c'est LUI qui piège le fixed, et React le réaffirme au re-render de
    //      `setInteractive(false)`. On le coupe donc explicitement (`auto`), et le
    //      JSX le garde `auto` tant que `!interactive` → pas de ré-affirmation.
    //   2. `scrollTo(0,0)` n'est pas fiable sur un scroller momentum → une fois le
    //      momentum coupé, `scrollTop = 0` reset de façon déterministe.
    //   3. il faut FORCER un reflow (`offsetHeight`) pour que tout soit appliqué
    //      avant le ré-ancrage fixed + le démarrage de l'anim.
    // Inerte sur Safari/desktop (où `overflow:hidden` suffisait déjà) → aucun risque
    // de régression sur les plateformes qui fonctionnent.
    const scroller = scrollRef.current;
    if (scroller) {
      // ORDRE IMPORTANT : reset PENDANT que c'est encore scrollable, PUIS on gèle.
      // Passer `overflow:hidden` avant peut rendre `scrollTop` non-réinscriptible
      // (élément non-scrollable) → le reset était ignoré et le contenu restait
      // décalé. On coupe le momentum, on remet en haut, on gèle, on flush.
      scroller.scrollTop = 0;
      scroller.style.setProperty('-webkit-overflow-scrolling', 'auto');
      scroller.style.overflowY = 'hidden';
      scroller.scrollTop = 0;
      void scroller.offsetHeight; // flush synchrone
    }

    // Ré-ancrage de la surface en fixed (état d'ouverture, scroll 0).
    surf.style.position = 'fixed';
    surf.style.top = `${g.fixTop}px`;
    surf.style.left = `${g.fixLeft}px`;
    surf.style.marginLeft = '0';
    surf.style.width = `${g.fixW}px`;
    surf.style.height = `${g.openH}px`;
    surf.style.borderRadius = '24px';
    surf.style.transform = 'none';
    surf.style.transformOrigin = 'top left';
    surf.style.overflow = 'hidden';
    if (encRef.current) encRef.current.style.width = `${g.fixW}px`;

    // AUTO-CORRECTION anti-piège (PWA iOS) — le vrai correctif.
    // Dans certains contextes WebKit (observé UNIQUEMENT en PWA standalone), un
    // `position: fixed` descendant d'un scroller s'ancre à ce SCROLLER et non au
    // viewport : la surface n'atterrit alors pas à (fixTop, fixLeft) et le
    // rétrécissement joue HORS écran → fermeture « invisible » (le bug persistant
    // que ni #258 ni le figeage d'overflow ne réglaient). On ne PARIE plus sur le
    // fait que le fixed soit viewport-relatif : on MESURE où la surface atterrit
    // réellement (`getBoundingClientRect` renvoie toujours des coords viewport) et
    // on compense l'écart exact. Inerte si le fixed est déjà correct (écart nul) →
    // zéro impact sur Safari/desktop. Le scroller étant gelé juste au-dessus,
    // l'offset reste CONSTANT pendant toute l'animation → correction valable sur
    // toutes les frames.
    {
      const got = surf.getBoundingClientRect();
      const dTop = got.top - g.fixTop;
      const dLeft = got.left - g.fixLeft;
      if (Math.abs(dTop) > 0.5 || Math.abs(dLeft) > 0.5) {
        surf.style.top = `${g.fixTop - dTop}px`;
        surf.style.left = `${g.fixLeft - dLeft}px`;
      }
    }

    // Bascule titre : le vrai titre (en flux) disparaît, le hero (fixe) reprend.
    if (encTitleRef.current) encTitleRef.current.style.opacity = '0';
    const hero = heroRef.current;
    if (hero) {
      hero.style.display = '';
      hero.style.opacity = '1';
      hero.style.transform = 'none';
      hero.style.top = `${g.heroTop}px`;
      hero.style.left = `${g.heroLeft}px`;
      hero.style.width = `${g.heroW}px`;
    }

    animsRef.current.forEach((a) => {
      try {
        a.commitStyles();
      } catch {
        /* anim non démarrée */
      }
      a.cancel();
    });
    animsRef.current = [];
    const store = animsRef.current;
    const d = SPRING_DURATION;

    const surfAnim = anim(surf, [g.surfTo, g.surfFrom], d, SPRING_EASING, store);
    anim(encRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.28 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(cardRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.84 }, { opacity: 1, offset: 1 }], d, FADE, store);
    anim(pageBgRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(hero, [{ transform: 'none' }, { transform: g.heroFrom }], d, SPRING_EASING, store);
    anim(hero, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.6 }, { opacity: 0, offset: 0.8 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(cardTitleRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.86 }, { opacity: 1, offset: 1 }], d, FADE, store);

    surfAnim?.finished.then(finishClose).catch(finishClose);
  }, [finishClose]);

  // ── Ouverture ──────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const surf = surfRef.current;
    const enc = encRef.current;
    const encTitle = encTitleRef.current;
    const card = cardRef.current;
    const cardTitle = cardTitleRef.current;
    const hero = heroRef.current;
    const pageBg = pageBgRef.current;
    if (!surf || !enc || !encTitle || !card || !cardTitle || !hero) return;

    const store = animsRef.current;
    const d = SPRING_DURATION;
    const c = source.cardRect;

    // État de repos (flux) posé en inline AVANT toute mesure — la surface n'a
    // aucune propriété de layout via le prop React (cf. JSX).
    surf.style.position = 'relative';
    surf.style.width = SURF_WIDTH;
    surf.style.height = 'auto';
    surf.style.borderRadius = '24px';
    surf.style.overflow = 'hidden';

    // Mesure de la surface DANS LE FLUX (avant de la passer en fixed) : top =
    // décalage haut, left = centré, width = SURF_WIDTH, height = contenu.
    const flowRect = surf.getBoundingClientRect();
    const encTitleRect = encTitle.getBoundingClientRect();
    const gridTitleRect = source.titleRect;
    const destFont = parseFloat(getComputedStyle(encTitle).fontSize) || 36;
    const cardFont = parseFloat(getComputedStyle(cardTitle).fontSize) || 15;

    // Hauteur d'OUVERTURE bornée au viewport (le contenu plus long défilera après
    // relâchement) → le morph n'« explose » pas en une boîte de 3000px.
    const openH = Math.min(flowRect.height, window.innerHeight - flowRect.top - 24);

    const dx = c.left - flowRect.left;
    const dy = c.top - flowRect.top;

    // Passage en fixed pour le morph (géométrie au pixel, comme le lab validé).
    surf.style.position = 'fixed';
    surf.style.top = `${flowRect.top}px`;
    surf.style.left = `${flowRect.left}px`;
    surf.style.marginLeft = '0';
    surf.style.transformOrigin = 'top left';
    surf.style.overflow = 'hidden';
    enc.style.width = `${flowRect.width}px`;

    const surfFrom: Keyframe = { transform: `translate(${dx}px, ${dy}px)`, width: `${c.width}px`, height: `${c.height}px`, borderRadius: '16px' };
    const surfTo: Keyframe = { transform: 'none', width: `${flowRect.width}px`, height: `${openH}px`, borderRadius: '24px' };
    Object.assign(surf.style, surfFrom);

    const hScale = cardFont / destFont;
    const heroFrom = `translate(${gridTitleRect.left - encTitleRect.left}px, ${gridTitleRect.top - encTitleRect.top}px) scale(${hScale})`;
    hero.style.top = `${encTitleRect.top}px`;
    hero.style.left = `${encTitleRect.left}px`;
    hero.style.width = `${encTitleRect.width}px`;
    hero.style.transform = heroFrom;

    gRef.current = {
      surfFrom,
      surfTo,
      heroFrom,
      fixTop: flowRect.top,
      fixLeft: flowRect.left,
      fixW: flowRect.width,
      openH,
      heroTop: encTitleRect.top,
      heroLeft: encTitleRect.left,
      heroW: encTitleRect.width,
    };

    if (pageBg) {
      const real = document.querySelector('.nc-app-bg');
      if (real) {
        const cs = getComputedStyle(real);
        pageBg.style.backgroundImage = cs.backgroundImage;
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') pageBg.style.backgroundColor = cs.backgroundColor;
      }
    }

    // Relâche la surface en flux (fin d'ouverture) : le contenu défile alors dans
    // le conteneur, le titre défile avec, la croix reste fixe.
    const release = () => {
      const s = surfRef.current;
      if (s) {
        // Repos en FLUX (identique à surfTo à scroll 0) → le contenu défile dans
        // le conteneur. Tout est posé explicitement (le prop React ne porte aucun
        // style de layout).
        s.style.position = 'relative';
        s.style.top = '';
        s.style.left = '';
        s.style.margin = '';
        s.style.marginLeft = '';
        s.style.width = SURF_WIDTH;
        s.style.height = 'auto';
        s.style.transform = 'none';
        s.style.transformOrigin = '';
        s.style.borderRadius = '24px';
        s.style.overflow = 'hidden';
      }
      // Le corps reprend sa largeur naturelle (la fige px avait évité le reflow).
      if (encRef.current) encRef.current.style.width = '';
      // Bascule titre : le hero (fixe) s'efface, le vrai titre (en flux) prend le
      // relais → il défilera avec le contenu.
      if (encTitleRef.current) encTitleRef.current.style.opacity = '1';
      if (heroRef.current) heroRef.current.style.display = 'none';
      setInteractive(true);
    };

    if (prefersReduced()) {
      Object.assign(surf.style, surfTo);
      if (pageBg) pageBg.style.opacity = '1';
      enc.style.opacity = '1';
      card.style.opacity = '0';
      cardTitle.style.opacity = '0';
      requestAnimationFrame(release);
      return;
    }

    anim(pageBg, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 1 }], d, FADE, store);
    const surfAnim = anim(surf, [surfFrom, surfTo], d, SPRING_EASING, store);
    anim(card, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0, offset: 0.32 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(enc, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.85 }, { opacity: 1, offset: 1 }], d, FADE, store);
    anim(cardTitle, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.07 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(hero, [{ transform: heroFrom }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(hero, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.22 }, { opacity: 1, offset: 1 }], d, FADE, store);

    surfAnim?.finished
      .then(() => {
        // Stoppe l'anim de surface (sinon `fill: both` retient la géométrie fixe)
        // PUIS relâche en flux dans le même tick → aucun repaint intermédiaire.
        try {
          surfAnim.cancel();
        } catch {
          /* noop */
        }
        release();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bouton « retour » (mobile/PWA) ferme l'overlay : on pousse une entrée
  // d'historique à la MÊME URL (aucune nav Next, aucun désync de router) ; le
  // popstate déclenche le morph de fermeture.
  useEffect(() => {
    try {
      window.history.pushState({ ncMorph: true }, '');
    } catch {
      /* noop */
    }
    const onPop = () => {
      poppedRef.current = true; // l'entrée a déjà été retirée par le navigateur
      startClose();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [startClose]);

  // Clavier : Échap ferme ; Tab est piégé DANS la surface (focus-trap modal) →
  // on ne peut pas tabuler vers la grille gelée derrière.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        startClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const surf = surfRef.current;
      if (!surf) return;
      const f = getFocusable(surf);
      if (f.length === 0) {
        e.preventDefault();
        surf.focus({ preventScroll: true });
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === surf || !surf.contains(active))) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (active === last || !surf.contains(active))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startClose]);

  // À l'ouverture : déplace le focus DANS le dialogue (la surface, tabindex -1)
  // → le lecteur d'écran annonce le titre (aria-label) et le focus ne reste pas
  // sur la carte masquée.
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      surfRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Verrou de scroll NON déplaçant de la GRILLE derrière : on fige l'overflow du
  // document SANS `position: fixed` (qui sauterait le scroll et tressauterait la
  // BottomNav en PWA iOS). La position de scroll de la grille n'est JAMAIS
  // modifiée → à la fermeture elle reste exactement où elle était. Le scroll du
  // CONTENU se fait dans le conteneur dédié de l'overlay (cf. scrollRef), pas
  // dans le document. `scrollRestoration: manual` empêche le history.back() de
  // restaurer le scroll de l'entrée précédente.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      scrollRestoration: history.scrollRestoration,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    try {
      history.scrollRestoration = 'manual';
    } catch {
      /* noop */
    }
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      try {
        history.scrollRestoration = prev.scrollRestoration;
      } catch {
        /* noop */
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      animsRef.current.forEach((a) => a.cancel());
      animsRef.current = [];
    };
  }, []);

  const badgeVariant = isResource ? 'ressource' : 'template';
  const badgeLabel = isResource ? 'Ressource' : 'Template';

  // Fermeture au tap sur le fond (hors surface) — basée sur les POINTER events
  // (le `click` sur un conteneur scrollable est avalé/différé sur iOS) avec une
  // DÉTENTE : on ferme seulement si le doigt n'a quasi pas bougé entre down et up
  // (sinon = scroll/drag → on ne ferme pas). Fiable et pas hypersensible.
  const pressRef = useRef<{ x: number; y: number; onBackdrop: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const onBackdrop = !surfRef.current?.contains(e.target as Node);
    pressRef.current = { x: e.clientX, y: e.clientY, onBackdrop };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = pressRef.current;
    pressRef.current = null;
    if (!p || !p.onBackdrop) return;
    if (surfRef.current?.contains(e.target as Node)) return; // relâché sur la surface
    const moved = Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
    if (moved < 12) startClose();
  };

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <div
        ref={pageBgRef}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-surface-page)', opacity: 0, pointerEvents: 'none', touchAction: 'none' }}
      />

      {/* Conteneur de SCROLL plein écran : c'est lui qui défile (pas le document,
          pas l'intérieur de la surface). Clic sur la zone vide → fermeture. */}
      <div
        ref={scrollRef}
        data-testid="morph-scroll"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{
          position: 'fixed',
          inset: 0,
          overflowX: 'hidden',
          overflowY: interactive ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
          // Momentum touch UNIQUEMENT quand le contenu est réellement scrollable
          // (interactive). Pendant les deux morphs (`!interactive`) on le coupe :
          // c'est ce layer qui piège le `position: fixed` de la surface sur iOS et
          // cassait le rétrécissement de fermeture en PWA (cf. startClose).
          WebkitOverflowScrolling: interactive ? 'touch' : 'auto',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
        {/* Centre la surface + décalage haut/bas ; ne capte pas le pointeur (les
            clics traversent vers le conteneur pour fermer), sauf sur la surface. */}
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: TOP_OFFSET,
            paddingBottom: 24,
            pointerEvents: 'none',
          }}
        >
          {/* SURFACE (encadré) : pendant le morph → fixed (piloté en JS) ; après
              ouverture → flux, hauteur = contenu, défile dans le conteneur.
              C'est le DIALOGUE a11y. */}
          <div
            ref={surfRef}
            role="dialog"
            aria-modal="true"
            aria-label={item.titre}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            // IMPORTANT : aucune propriété de LAYOUT ici (position/width/height/
            // overflow/border-radius/top/left/transform). Elles sont pilotées
            // EXCLUSIVEMENT en inline JS (morph + repos) → un re-render (ex. arrivée
            // async du body) ne peut pas réinitialiser la géométrie en plein morph.
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--nc-shadow-3)',
              outline: 'none',
              pointerEvents: 'auto',
              willChange: 'width, height, transform, border-radius',
            }}
          >
            {/* Contenu ENCADRÉ (header + corps réel) */}
            <div ref={encRef} style={{ padding: 32, opacity: 0, willChange: 'opacity' }}>
              <h1 ref={encTitleRef} style={{ ...H1_STYLE, opacity: 0, marginBottom: 16 }}>{item.titre}</h1>
              <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>{item.description}</p>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>{formatDate(item.dateCreation)}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ResourceBadge variant={badgeVariant} label={badgeLabel} />
                {resource?.formation?.map((f) => <ResourceBadge key={f} variant="formation" label={f} />)}
                {resource?.type?.map((t) => <ResourceBadge key={t} variant="type" label={t} />)}
                {template && <ResourceBadge variant="type" label={template.type} />}
              </div>

              {/* CORPS — source unique partagée avec la vraie page détail.
                  Chargé via Server Action (skeleton tant que `body === null`). */}
              {resource &&
                (hasAccess && body === null ? (
                  <ResourceBodySkeleton />
                ) : (
                  <div
                    style={
                      startedEmpty && !reduced
                        ? {
                            opacity: contentIn ? 1 : 0,
                            transform: contentIn ? 'none' : 'translateY(12px)',
                            filter: contentIn ? 'blur(0px)' : 'blur(3px)',
                            transition:
                              'opacity 600ms cubic-bezier(0.22, 1, 0.36, 1), transform 600ms cubic-bezier(0.22, 1, 0.36, 1), filter 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                            willChange: 'opacity, transform, filter',
                          }
                        : undefined
                    }
                  >
                    <ResourceContentBody
                      resource={body ? { ...resource, content: body } : resource}
                    />
                  </div>
                ))}
              {template && (
                <div style={{ marginTop: 24 }}>
                  {template.urlTella && (
                    <div style={{ marginBottom: hasAccess ? 8 : 24 }}><TellaEmbed url={template.urlTella} /></div>
                  )}
                  {hasAccess ? (
                    <DuplicateButton url={template.urlNotionPublicPage} />
                  ) : (
                    <CapabilityLock
                      title={`Template réservé aux membres ${template.visibilite}`}
                      description={`Ce template est accessible à partir de l'offre ${template.visibilite}. Rejoins le programme pour le dupliquer ainsi que toute la bibliothèque correspondante.`}
                      ctaLabel="Découvrir les offres"
                      ctaHref="/offres"
                    />
                  )}
                </div>
              )}
            </div>

            {/* CROIX — ancrée en haut à droite de la CARTE (défile avec elle :
                visible en haut, disparaît quand on descend). */}
            <button
              type="button"
              onClick={startClose}
              aria-label="Fermer"
              style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '1px solid var(--color-border-default)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 2, opacity: interactive ? 1 : 0, pointerEvents: interactive ? 'auto' : 'none', transition: 'opacity 160ms ease' }}
            >
              ✕
            </button>

            {/* Clone du CONTENU CARTE (départ) — réplique la carte de la grille */}
            <div
              ref={cardRef}
              style={{ position: 'absolute', top: 0, left: 0, width: source.cardRect.width, padding: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, willChange: 'opacity', pointerEvents: 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <ResourceBadge variant={badgeVariant} label={badgeLabel} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h3 ref={cardTitleRef} style={CARD_TITLE_STYLE}>{item.titre}</h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {resource?.formation?.map((f) => <ResourceBadge key={f} variant="formation" label={f} />)}
                {resource?.type?.map((t) => <ResourceBadge key={t} variant="type" label={t} />)}
                {template && <ResourceBadge variant="type" label={template.type} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLOU HAUT (PWA) : bande floutée en haut → le contenu se brouille en
          remontant. Masquée en dégradé (fort en haut, nul en bas) pour ne PAS
          couvrir la croix/le titre au repos (situés sous la bande). Non
          interactive ; visible seulement une fois l'overlay ouvert. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: TOP_OFFSET,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: interactive ? 1 : 0,
          transition: 'opacity 200ms ease',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 35%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, #000 35%, transparent 100%)',
        }}
      />

      {/* TITRE CONTINU (hero) — uniquement pendant le morph */}
      <h1 ref={heroRef} style={{ ...H1_STYLE, position: 'fixed', transformOrigin: 'top left', willChange: 'transform, opacity', pointerEvents: 'none', zIndex: 2 }}>
        {item.titre}
      </h1>
    </div>
  );

  return createPortal(overlay, document.body);
}
