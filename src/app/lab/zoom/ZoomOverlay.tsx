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
import type { LabResource } from './mock';
import { LabBadge } from './LabBadge';
import { SPRING_EASING, SPRING_DURATION } from './spring';

export interface ZoomSource {
  resource: LabResource;
  cardRect: DOMRect;
}

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// IMPORTANT WAAPI : toute keyframe d'opacité DOIT aller jusqu'à offset 1, sinon
// la valeur dérive vers la base au-delà du dernier offset (cf. bug doublage).
const FADE = 'linear';

const H1_STYLE: CSSProperties = {
  fontSize: 'clamp(28px, 6vw, 38px)',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: 'var(--color-text-primary)',
  margin: 0,
  lineHeight: 1.15,
};

const CARD_TITLE_STYLE: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  margin: 0,
  lineHeight: 1.4,
};

const anim = (
  el: Element | null,
  keyframes: Keyframe[],
  duration: number,
  easing: string,
  store: Animation[],
): Animation | null => {
  if (!el) return null;
  const a = el.animate(keyframes, { duration, easing, fill: 'both' });
  store.push(a);
  return a;
};

export function ZoomOverlay({
  source,
  onClosed,
}: {
  source: ZoomSource;
  onClosed: () => void;
}) {
  const pageBgRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<HTMLDivElement>(null);
  const encRef = useRef<HTMLDivElement>(null);
  const encTitleRef = useRef<HTMLHeadingElement>(null); // titre encadré (caché, gabarit + mesure)
  const cardRef = useRef<HTMLDivElement>(null);
  const cardTitleRef = useRef<HTMLHeadingElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null); // TITRE CONTINU qui voyage

  const gRef = useRef<{
    surfFrom: Keyframe;
    surfTo: Keyframe;
    track: string;
    cardOut: string;
    heroFrom: string;
  } | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const closingRef = useRef(false);
  const [interactive, setInteractive] = useState(false);

  // ── Ouverture ───────────────────────────────────────────────────────────
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

    // Mesures (tout à l'identité).
    const destRect = enc.getBoundingClientRect();
    const encTitleRect = encTitle.getBoundingClientRect();
    const cardTitleRect = cardTitle.getBoundingClientRect();
    const destFont = parseFloat(getComputedStyle(encTitle).fontSize) || 36;
    const cardFont = parseFloat(getComputedStyle(cardTitle).fontSize) || 15;

    const dx = c.left - destRect.left;
    const dy = c.top - destRect.top;

    // Surface VIDE : width/height/translate/radius (coins lisses).
    surf.style.top = `${destRect.top}px`;
    surf.style.left = `${destRect.left}px`;
    const surfFrom: Keyframe = { transform: `translate(${dx}px, ${dy}px)`, width: `${c.width}px`, height: `${c.height}px`, borderRadius: '16px' };
    const surfTo: Keyframe = { transform: 'none', width: `${destRect.width}px`, height: `${destRect.height}px`, borderRadius: '24px' };
    Object.assign(surf.style, surfFrom);

    const track = `translate(${dx}px, ${dy}px)`;
    const cardOut = `translate(${-dx}px, ${-dy}px)`;
    enc.style.transform = track;

    // TITRE CONTINU (hero) : gabarit ENCADRÉ (donc identique au titre encadré à
    // la cible), ramené à la position/taille du titre CARTE par scale uniforme.
    const hScale = cardFont / destFont;
    const heroFrom = `translate(${cardTitleRect.left - encTitleRect.left}px, ${cardTitleRect.top - encTitleRect.top}px) scale(${hScale})`;
    hero.style.top = `${encTitleRect.top}px`;
    hero.style.left = `${encTitleRect.left}px`;
    hero.style.width = `${encTitleRect.width}px`;
    hero.style.transform = heroFrom;

    gRef.current = { surfFrom, surfTo, track, cardOut, heroFrom };

    if (pageBg) {
      const real = document.querySelector('.nc-app-bg');
      if (real) {
        const cs = getComputedStyle(real);
        pageBg.style.backgroundImage = cs.backgroundImage;
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') pageBg.style.backgroundColor = cs.backgroundColor;
      }
    }

    if (prefersReduced()) {
      Object.assign(surf.style, surfTo);
      if (pageBg) pageBg.style.opacity = '1';
      enc.style.transform = 'none';
      enc.style.opacity = '1';
      card.style.opacity = '0';
      hero.style.transform = 'none';
      cardTitle.style.opacity = '0';
      requestAnimationFrame(() => setInteractive(true));
      return;
    }

    // Fond opaque quasi-immédiat.
    anim(pageBg, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 1 }], d, FADE, store);
    // Surface.
    const surfAnim = anim(surf, [surfFrom, surfTo], d, SPRING_EASING, store);

    // CONTENUS (desc/badges/body) en fade-through ; les TITRES sont gérés par le hero.
    anim(card, [{ transform: 'none' }, { transform: cardOut }], d, SPRING_EASING, store);
    anim(card, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0, offset: 0.4 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(enc, [{ transform: track }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(enc, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1, offset: 0.85 }, { opacity: 1, offset: 1 }], d, FADE, store);

    // TITRE CONTINU : voyage+grandit (spring). Handoff NET avec le titre carte au
    // tout début (le titre carte s'efface vite, le hero prend le relais) → 1 seul
    // titre par frame.
    anim(hero, [{ transform: heroFrom }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(hero, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 1 }], d, FADE, store);
    anim(cardTitle, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.07 }, { opacity: 0, offset: 1 }], d, FADE, store);

    surfAnim?.finished.then(() => setInteractive(true)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fermeture ───────────────────────────────────────────────────────────
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setInteractive(false);

    const g = gRef.current;
    const surf = surfRef.current;
    if (!g || !surf) return onClosed();
    if (prefersReduced()) return onClosed();

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
    // Contenus : encadré part tôt, carte revient en fin (fade-through).
    anim(encRef.current, [{ transform: 'none' }, { transform: g.track }], d, SPRING_EASING, store);
    anim(encRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(cardRef.current, [{ transform: g.cardOut }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(cardRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1, offset: 0.95 }, { opacity: 1, offset: 1 }], d, FADE, store);
    anim(pageBgRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 1 }], d, FADE, store);

    // TITRE CONTINU : voyage+rétrécit jusqu'à la position grille (spring), reste
    // visible JUSQU'À L'ARRIVÉE (~88%), PUIS s'efface en douceur → ensuite seul le
    // titre de carte/grille apparaît. Jamais deux titres sur la même frame.
    anim(heroRef.current, [{ transform: 'none' }, { transform: g.heroFrom }], d, SPRING_EASING, store);
    anim(heroRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.88 }, { opacity: 0, offset: 0.96 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(cardTitleRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.95 }, { opacity: 1, offset: 1 }], d, FADE, store);

    surfAnim?.finished.then(onClosed).catch(onClosed);
  }, [onClosed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(() => {
    return () => {
      animsRef.current.forEach((a) => a.cancel());
      animsRef.current = [];
    };
  }, []);

  const { resource } = source;

  const overlay = (
    <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <div
        ref={pageBgRef}
        onClick={close}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-surface-page)', opacity: 0, pointerEvents: interactive ? 'auto' : 'none' }}
      />

      {/* Surface VIDE qui morphe */}
      <div
        ref={surfRef}
        data-debug="surface"
        style={{
          position: 'fixed',
          transformOrigin: 'top left',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--nc-shadow-3)',
          borderRadius: 16,
          willChange: 'width, height, transform, border-radius',
          pointerEvents: 'none',
        }}
      />

      {/* Contenu ENCADRÉ (titre caché : le hero le recouvre exactement à la cible) */}
      <div
        ref={encRef}
        data-debug="enc-content"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
          left: '50%',
          marginLeft: 'calc(min(640px, 100vw - 32px) * -0.5)',
          width: 'min(640px, calc(100vw - 32px))',
          transformOrigin: 'top left',
          padding: 28,
          boxSizing: 'border-box',
          opacity: 0,
          willChange: 'transform, opacity',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
        <h1 ref={encTitleRef} style={{ ...H1_STYLE, opacity: 0, marginBottom: 14 }}>{resource.titre}</h1>
        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>{resource.description}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          <LabBadge kind="ressource" label="Ressource" />
          <LabBadge kind="formation" label={resource.formation} />
          <LabBadge kind="type" label={resource.type} />
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: '0 0 22px' }} />
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: '0 0 14px' }}>
          Aperçu mocké : le titre est un élément CONTINU qui voyage et se met à
          l’échelle ; le reste se relaie sans superposition.
        </p>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>Ferme avec la croix, le fond ou Échap.</p>

        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '1px solid var(--color-border-default)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* Contenu CARTE (titre = relais NET avec le hero aux extrémités) */}
      <div
        ref={cardRef}
        data-debug="card-content"
        style={{ position: 'fixed', top: source.cardRect.top, left: source.cardRect.left, width: source.cardRect.width, height: source.cardRect.height, padding: 20, boxSizing: 'border-box', transformOrigin: 'top left', display: 'flex', flexDirection: 'column', gap: 12, willChange: 'transform, opacity', pointerEvents: 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <LabBadge kind="ressource" label="Ressource" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 ref={cardTitleRef} style={CARD_TITLE_STYLE}>{resource.titre}</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{resource.description}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <LabBadge kind="formation" label={resource.formation} />
          <LabBadge kind="type" label={resource.type} />
        </div>
      </div>

      {/* TITRE CONTINU (hero) — gabarit encadré, voyage entre carte et page */}
      <h1
        ref={heroRef}
        data-debug="hero-title"
        style={{ ...H1_STYLE, position: 'fixed', transformOrigin: 'top left', willChange: 'transform, opacity', pointerEvents: 'none' }}
      >
        {resource.titre}
      </h1>
    </div>
  );

  return createPortal(overlay, document.body);
}
