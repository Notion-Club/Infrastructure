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
import { SPRING_EASING, SPRING_DURATION, FADE_EASING } from './spring';

// Géométrie source capturée au clic (rects en coordonnées viewport).
export interface ZoomSource {
  resource: LabResource;
  cardRect: DOMRect;
  titleRect: DOMRect;
  titleFontSize: number;
}

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Titre de l'encadré (grand) — partagé entre le H1 réel (caché) et le titre
// ANCRÉ qui morphe. Doit être pixel-identique pour un ancrage invisible.
const H1_STYLE: CSSProperties = {
  fontSize: 'clamp(32px, 7vw, 44px)',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: 'var(--color-text-primary)',
  margin: 0,
  lineHeight: 1.1,
};

// Titre de la carte (petit) — reproduit la DNA `ResourceCard` h3.
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
  const boxRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null); // conteneur encadré → rect cible
  const encTitleRef = useRef<HTMLHeadingElement>(null);
  const encLayerRef = useRef<HTMLDivElement>(null);
  const cardLayerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null);

  const geomRef = useRef<{ fromBox: string; fromTitle: string } | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const closingRef = useRef(false);
  const [interactive, setInteractive] = useState(false);

  // ── Ouverture ───────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const box = boxRef.current;
    const dest = destRef.current;
    const encTitle = encTitleRef.current;
    const hero = heroRef.current;
    const pageBg = pageBgRef.current;
    if (!box || !dest || !encTitle || !hero) return;

    // Fond de page : on copie le background RÉEL de `.nc-app-bg` (thème-exact).
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

    const reduced = prefersReduced();
    const store = animsRef.current;

    const destRect = dest.getBoundingClientRect();
    const destTitleRect = encTitle.getBoundingClientRect();
    const destTitleFont = parseFloat(getComputedStyle(encTitle).fontSize) || 40;

    // Clone au RECT CIBLE, ramené au rect source par un transform (FLIP).
    box.style.top = `${destRect.top}px`;
    box.style.left = `${destRect.left}px`;
    box.style.width = `${destRect.width}px`;
    box.style.height = `${destRect.height}px`;

    const c = source.cardRect;
    const sx = c.width / destRect.width;
    const sy = c.height / destRect.height;
    const fromBox = `translate(${c.left - destRect.left}px, ${c.top - destRect.top}px) scale(${sx}, ${sy})`;

    // Titre ancré : en LAYOUT ENCADRÉ, ramené au titre source par scale uniforme.
    const tt = source.titleRect;
    const tScale = source.titleFontSize / destTitleFont;
    const fromTitle = `translate(${tt.left - destTitleRect.left}px, ${tt.top - destTitleRect.top}px) scale(${tScale})`;

    hero.style.top = `${destTitleRect.top}px`;
    hero.style.left = `${destTitleRect.left}px`;
    hero.style.width = `${destTitleRect.width}px`;

    geomRef.current = { fromBox, fromTitle };

    if (reduced) {
      box.style.transform = 'none';
      box.style.borderRadius = 'var(--nc-radius-md)';
      if (pageBg) pageBg.style.opacity = '1';
      if (cardLayerRef.current) cardLayerRef.current.style.opacity = '0';
      if (encLayerRef.current) encLayerRef.current.style.opacity = '1';
      hero.style.opacity = '0';
      encTitle.style.opacity = '1';
      requestAnimationFrame(() => setInteractive(true));
      return;
    }

    const d = SPRING_DURATION;

    // Fond de page opaque → couvre la grille tôt (bascule de PAGE, pas popup).
    anim(pageBg, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.28 }, { opacity: 1, offset: 1 }], d, FADE_EASING, store);

    // Conteneur : transform spring + border-radius 16 → 24.
    const boxAnim = anim(
      box,
      [
        { transform: fromBox, borderRadius: '16px' },
        { transform: 'none', borderRadius: 'var(--nc-radius-md)' },
      ],
      d,
      SPRING_EASING,
      store,
    );

    // Titre ancré : spring (transform) + handoff rapide depuis le titre carte.
    anim(hero, [{ transform: fromTitle }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(hero, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 1, offset: 1 }], d, FADE_EASING, store);

    // Contenu carte (titre carte + badges + desc) : sort très tôt (handoff titre).
    anim(cardLayerRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 0, offset: 1 }], d, FADE_EASING, store);

    // Contenu encadré : entre tard.
    anim(encLayerRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 1 }], d, FADE_EASING, store);

    boxAnim?.finished.then(() => setInteractive(true)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fermeture (symétrique) ──────────────────────────────────────────────
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setInteractive(false);

    const geom = geomRef.current;
    const box = boxRef.current;
    if (!geom || !box) return onClosed();
    if (prefersReduced()) return onClosed();

    // Fige l'état courant en inline avant de réanimer (pas de saut au cancel).
    animsRef.current.forEach((a) => {
      try {
        a.commitStyles();
      } catch {
        /* anim non encore démarrée */
      }
      a.cancel();
    });
    animsRef.current = [];
    const store = animsRef.current;
    const d = SPRING_DURATION;

    const boxAnim = anim(
      box,
      [
        { transform: 'none', borderRadius: 'var(--nc-radius-md)' },
        { transform: geom.fromBox, borderRadius: '16px' },
      ],
      d,
      SPRING_EASING,
      store,
    );
    anim(heroRef.current, [{ transform: 'none' }, { transform: geom.fromTitle }], d, SPRING_EASING, store);
    anim(heroRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.8 }, { opacity: 0, offset: 1 }], d, FADE_EASING, store);
    anim(pageBgRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.72 }, { opacity: 0, offset: 1 }], d, FADE_EASING, store);
    anim(encLayerRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 0, offset: 1 }], d, FADE_EASING, store);
    // Contenu carte : revient en toute fin → atterrissage pixel-exact sur la grille.
    anim(cardLayerRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.82 }, { opacity: 1, offset: 1 }], d, FADE_EASING, store);

    boxAnim?.finished.then(onClosed).catch(onClosed);
  }, [onClosed]);

  // Échap ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Nettoyage explicite du clone au démontage.
  useEffect(() => {
    return () => {
      animsRef.current.forEach((a) => a.cancel());
      animsRef.current = [];
    };
  }, []);

  const { resource } = source;

  const overlay = (
    <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      {/* Fond de PAGE opaque (réplique .nc-app-bg) — couvre la grille */}
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

      {/* Clone — surface qui morphe (bg/bordure/ombre/radius) */}
      <div
        ref={boxRef}
        style={{
          position: 'fixed',
          transformOrigin: 'top left',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--nc-shadow-3)',
          borderRadius: 16,
          willChange: 'transform, border-radius',
          pointerEvents: 'none',
        }}
      />

      {/* Conteneur ENCADRÉ — définit le rect cible + contenu (fade tardif) */}
      <div
        ref={destRef}
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(720px, calc(100vw - 32px))',
          pointerEvents: 'none',
        }}
      >
        <div ref={encLayerRef} style={{ padding: 32, opacity: 0, pointerEvents: interactive ? 'auto' : 'none' }}>
          {/* H1 réel caché : le titre ANCRÉ le recouvre. Garde le layout. */}
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
            Aperçu mocké du contenu. Le morph transporte la carte vers cette page :
            fond de page opaque (la grille disparaît), titre ancré continu, surface
            unique qui grandit — pas un pop-up superposé.
          </p>
          <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
            Ferme avec la croix, le fond ou Échap — fermeture symétrique.
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
      </div>

      {/* Contenu CARTE (au rect source) — titre carte + badges + desc */}
      <div
        ref={cardLayerRef}
        style={{
          position: 'fixed',
          top: source.cardRect.top,
          left: source.cardRect.left,
          width: source.cardRect.width,
          height: source.cardRect.height,
          padding: 20,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <LabBadge kind="ressource" label="Ressource" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 style={CARD_TITLE_STYLE}>{resource.titre}</h3>
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

      {/* Titre ANCRÉ — layout encadré, morphe entre carte et page (continu) */}
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
