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
import { SPRING_EASING, SPRING_DURATION, FADE_OUT_EASING, FADE_IN_EASING } from './spring';

export interface ZoomSource {
  resource: LabResource;
  cardRect: DOMRect;
  titleRect: DOMRect;
  titleFontSize: number;
}

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const H1_STYLE: CSSProperties = {
  fontSize: 'clamp(32px, 7vw, 44px)',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: 'var(--color-text-primary)',
  margin: 0,
  lineHeight: 1.1,
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
  const surfRef = useRef<HTMLDivElement>(null); // surface VIDE — width/height/radius (coins lisses)
  const encRef = useRef<HTMLDivElement>(null); // contenu encadré (scale uniforme)
  const encTitleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null); // contenu carte transporté
  const cardTitleRef = useRef<HTMLHeadingElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null); // titre ancré continu

  // Géométrie figée à l'ouverture, réutilisée à la fermeture.
  const gRef = useRef<{
    surfFrom: Keyframe;
    surfTo: Keyframe;
    encFrom: string;
    cardTo: string;
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
    const hero = heroRef.current;
    const card = cardRef.current;
    const pageBg = pageBgRef.current;
    if (!surf || !enc || !encTitle || !hero || !card) return;

    const store = animsRef.current;
    const d = SPRING_DURATION;
    const c = source.cardRect;

    // 1) Mesures (encRef à l'identité = position/dimensions cibles).
    const destRect = enc.getBoundingClientRect();
    const destTitleRect = encTitle.getBoundingClientRect();
    const destTitleFont = parseFloat(getComputedStyle(encTitle).fontSize) || 40;

    const dx = c.left - destRect.left;
    const dy = c.top - destRect.top;
    const kDown = c.width / destRect.width; // scale uniforme contenu (carte ← encadré)
    const kUp = destRect.width / c.width;

    // 2) Surface VIDE : anime width/height/translate/radius (PAS de scale → coins ronds, lisses).
    surf.style.top = `${destRect.top}px`;
    surf.style.left = `${destRect.left}px`;
    const surfFrom: Keyframe = {
      transform: `translate(${dx}px, ${dy}px)`,
      width: `${c.width}px`,
      height: `${c.height}px`,
      borderRadius: '16px',
    };
    const surfTo: Keyframe = {
      transform: 'none',
      width: `${destRect.width}px`,
      height: `${destRect.height}px`,
      borderRadius: '24px', // --nc-radius-md (littéral : WAAPI n'interpole pas var())
    };
    Object.assign(surf.style, {
      transform: surfFrom.transform as string,
      width: surfFrom.width as string,
      height: surfFrom.height as string,
      borderRadius: '16px',
    });

    // 3) Contenu encadré : scale UNIFORME (zéro distorsion) depuis la carte.
    const encFrom = `translate(${dx}px, ${dy}px) scale(${kDown})`;
    enc.style.transform = encFrom;

    // 4) Contenu carte : transporté (scale uniforme) vers l'encadré.
    const cardTo = `translate(${-dx}px, ${-dy}px) scale(${kUp})`;

    // 5) Titre ancré : layout encadré, ramené au titre carte (scale uniforme).
    const tScale = source.titleFontSize / destTitleFont;
    const heroFrom = `translate(${source.titleRect.left - destTitleRect.left}px, ${source.titleRect.top - destTitleRect.top}px) scale(${tScale})`;
    hero.style.top = `${destTitleRect.top}px`;
    hero.style.left = `${destTitleRect.left}px`;
    hero.style.width = `${destTitleRect.width}px`;
    hero.style.transform = heroFrom;

    gRef.current = { surfFrom, surfTo, encFrom, cardTo, heroFrom };

    // Fond de page : copie le background RÉEL de .nc-app-bg (thème-exact).
    if (pageBg) {
      const real = document.querySelector('.nc-app-bg');
      if (real) {
        const cs = getComputedStyle(real);
        pageBg.style.backgroundImage = cs.backgroundImage;
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          pageBg.style.backgroundColor = cs.backgroundColor;
        }
      }
    }

    if (prefersReduced()) {
      Object.assign(surf.style, { transform: 'none', width: `${destRect.width}px`, height: `${destRect.height}px`, borderRadius: '24px' });
      if (pageBg) pageBg.style.opacity = '1';
      enc.style.transform = 'none';
      enc.style.opacity = '1';
      card.style.opacity = '0';
      hero.style.opacity = '0';
      encTitle.style.opacity = '1';
      requestAnimationFrame(() => setInteractive(true));
      return;
    }

    // Fond opaque QUASI-IMMÉDIAT → l'index passe derrière la page.
    anim(pageBg, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 1 }], d, FADE_IN_EASING, store);

    // Surface : width/height/translate/radius, ressort SANS overshoot.
    const surfAnim = anim(surf, [surfFrom, surfTo], d, SPRING_EASING, store);

    // Contenu encadré : grandit (scale uniforme) + entre en fondu TARDIF.
    anim(enc, [{ transform: encFrom }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(enc, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 1 }], d, FADE_IN_EASING, store);

    // Contenu carte : transporté, EXTRAS visibles tôt puis sortie ; titre = swap NET.
    anim(card, [{ transform: 'none' }, { transform: cardTo }], d, SPRING_EASING, store);
    anim(card, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0, offset: 0.42 }], d, FADE_OUT_EASING, store);

    // Titre : bascule NETTE carte → hero (un seul visible à la fois).
    anim(cardTitleRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0, offset: 0.13 }], d, FADE_OUT_EASING, store);
    anim(hero, [{ transform: heroFrom }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(hero, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.13 }], d, FADE_IN_EASING, store);

    surfAnim?.finished.then(() => setInteractive(true)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fermeture (symétrique, contenu hors-champ pendant le morph) ─────────
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
    // Contenu encadré : disparaît DÈS LE DÉPART (ease-out) + se réduit (scale).
    anim(encRef.current, [{ transform: 'none' }, { transform: g.encFrom }], d, SPRING_EASING, store);
    anim(encRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.22 }, { opacity: 0, offset: 1 }], d, FADE_OUT_EASING, store);
    // Fond de page : se retire en fin → l'index réapparaît quand la carte rentre.
    anim(pageBgRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 0, offset: 1 }], d, FADE_OUT_EASING, store);
    // Contenu carte : revient en TOUTE FIN → pas de doublon à mi-course.
    anim(cardRef.current, [{ transform: g.cardTo }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(cardRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1, offset: 1 }], d, FADE_IN_EASING, store);
    // Titre : hero jusqu'au bout, bascule NETTE vers le titre carte à la toute fin.
    anim(heroRef.current, [{ transform: 'none' }, { transform: g.heroFrom }], d, SPRING_EASING, store);
    anim(heroRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.86 }, { opacity: 0, offset: 0.9 }], d, FADE_OUT_EASING, store);
    anim(cardTitleRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.87 }, { opacity: 1, offset: 0.9 }], d, FADE_IN_EASING, store);

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
      {/* Fond de PAGE opaque — couvre l'index */}
      <div
        ref={pageBgRef}
        onClick={close}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--color-surface-page)',
          opacity: 0,
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      />

      {/* Surface VIDE qui morphe (width/height/radius → coins lisses) */}
      <div
        ref={surfRef}
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

      {/* Contenu ENCADRÉ (scale uniforme, séparé de la surface) */}
      <div
        ref={encRef}
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
          left: '50%',
          marginLeft: 'calc(min(720px, 100vw - 32px) * -0.5)',
          width: 'min(720px, calc(100vw - 32px))',
          transformOrigin: 'top left',
          padding: 32,
          boxSizing: 'border-box',
          opacity: 0,
          willChange: 'transform, opacity',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
        <h1 ref={encTitleRef} style={{ ...H1_STYLE, opacity: 0, marginBottom: 16 }}>
          {resource.titre}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
          {resource.description}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <LabBadge kind="ressource" label="Ressource" />
          <LabBadge kind="formation" label={resource.formation} />
          <LabBadge kind="type" label={resource.type} />
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: '0 0 24px' }} />
        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: '0 0 16px' }}>
          Aperçu mocké : la carte est transportée vers cette page. Surface aux
          coins lisses, contenu qui grandit/réduit avec elle, index masqué.
        </p>
        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Ferme avec la croix, le fond ou Échap.
        </p>

        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9999,
            border: '1px solid var(--color-border-default)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Contenu CARTE transporté */}
      <div
        ref={cardRef}
        style={{
          position: 'fixed',
          top: source.cardRect.top,
          left: source.cardRect.left,
          width: source.cardRect.width,
          height: source.cardRect.height,
          padding: 20,
          boxSizing: 'border-box',
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          willChange: 'transform, opacity',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <LabBadge kind="ressource" label="Ressource" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 ref={cardTitleRef} style={CARD_TITLE_STYLE}>{resource.titre}</h3>
          <p
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              margin: 0,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {resource.description}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <LabBadge kind="formation" label={resource.formation} />
          <LabBadge kind="type" label={resource.type} />
        </div>
      </div>

      {/* Titre ANCRÉ continu (bascule nette avec le titre carte aux extrémités) */}
      <h1
        ref={heroRef}
        style={{
          ...H1_STYLE,
          position: 'fixed',
          transformOrigin: 'top left',
          willChange: 'transform, opacity',
          pointerEvents: 'none',
        }}
      >
        {resource.titre}
      </h1>
    </div>
  );

  return createPortal(overlay, document.body);
}
