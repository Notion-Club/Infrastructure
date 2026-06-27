'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ResourceBadge } from '../shared/ResourceBadge';
import { useMorphSourceRef, type MorphSource } from './MorphSourceContext';
import type { Resource } from '../../types';
import { SPRING_EASING, SPRING_DURATION } from '../../lib/spring';

// Morph WAAPI (mécanique validée au lab v9) appliqué au vrai /Ressources :
// surface clippée qui morphe (coins lisses), titre CONTINU (hero) qui voyage,
// fade-through à gap des contenus. Le CORPS réel Notion est passé en `children`
// (RSC, Suspense). Fermeture → router.back() (route intercoptée).

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

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const anim = (el: Element | null, kf: Keyframe[], duration: number, easing: string, store: Animation[]): Animation | null => {
  if (!el) return null;
  const a = el.animate(kf, { duration, easing, fill: 'both' });
  store.push(a);
  return a;
};

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ResourceMorphOverlay({ children }: { children: ReactNode }) {
  const router = useRouter();
  const sourceRef = useMorphSourceRef();
  // Lu UNE fois au montage : la géométrie + données de la carte cliquée.
  const [source] = useState<MorphSource | null>(() => sourceRef.current);

  const pageBgRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<HTMLDivElement>(null);
  const encRef = useRef<HTMLDivElement>(null);
  const encTitleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardTitleRef = useRef<HTMLHeadingElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null);

  const gRef = useRef<{ surfFrom: Keyframe; surfTo: Keyframe; heroFrom: string } | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const closingRef = useRef(false);
  const [interactive, setInteractive] = useState(false);

  const onClosed = useCallback(() => router.back(), [router]);

  // ── Ouverture ───────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!source) {
      // Pas de carte source (accès direct improbable via intercept) → pas de morph.
      requestAnimationFrame(() => setInteractive(true));
      return;
    }
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

    const destRect = surf.getBoundingClientRect();
    const encTitleRect = encTitle.getBoundingClientRect();
    const gridTitleRect = source.titleRect;
    const destFont = parseFloat(getComputedStyle(encTitle).fontSize) || 36;
    const cardFont = parseFloat(getComputedStyle(cardTitle).fontSize) || 15;

    const dx = c.left - destRect.left;
    const dy = c.top - destRect.top;

    surf.style.top = `${destRect.top}px`;
    surf.style.left = `${destRect.left}px`;
    surf.style.marginLeft = '0';
    surf.style.transformOrigin = 'top left';
    enc.style.width = `${destRect.width}px`;

    const surfFrom: Keyframe = { transform: `translate(${dx}px, ${dy}px)`, width: `${c.width}px`, height: `${c.height}px`, borderRadius: '16px' };
    const surfTo: Keyframe = { transform: 'none', width: `${destRect.width}px`, height: `${destRect.height}px`, borderRadius: '24px' };
    Object.assign(surf.style, surfFrom);

    const hScale = cardFont / destFont;
    const heroFrom = `translate(${gridTitleRect.left - encTitleRect.left}px, ${gridTitleRect.top - encTitleRect.top}px) scale(${hScale})`;
    hero.style.top = `${encTitleRect.top}px`;
    hero.style.left = `${encTitleRect.left}px`;
    hero.style.width = `${encTitleRect.width}px`;
    hero.style.transform = heroFrom;

    gRef.current = { surfFrom, surfTo, heroFrom };

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
      enc.style.opacity = '1';
      card.style.opacity = '0';
      hero.style.transform = 'none';
      cardTitle.style.opacity = '0';
      requestAnimationFrame(() => setInteractive(true));
      return;
    }

    anim(pageBg, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 1 }], d, FADE, store);
    const surfAnim = anim(surf, [surfFrom, surfTo], d, SPRING_EASING, store);
    anim(card, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0, offset: 0.32 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(enc, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.85 }, { opacity: 1, offset: 1 }], d, FADE, store);
    anim(cardTitle, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.07 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(hero, [{ transform: heroFrom }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(hero, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.22 }, { opacity: 1, offset: 1 }], d, FADE, store);

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
    if (!g || !surf || !source) return onClosed();
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
    anim(encRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.28 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(cardRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.84 }, { opacity: 1, offset: 1 }], d, FADE, store);
    anim(pageBgRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(heroRef.current, [{ transform: 'none' }, { transform: g.heroFrom }], d, SPRING_EASING, store);
    anim(heroRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.6 }, { opacity: 0, offset: 0.8 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(cardTitleRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.86 }, { opacity: 1, offset: 1 }], d, FADE, store);

    surfAnim?.finished.then(onClosed).catch(onClosed);
  }, [onClosed, source]);

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

  // Données carte (header instantané, sans fetch). On suppose une Resource.
  const resource = source?.resource as Resource | undefined;

  const overlay = (
    <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <div
        ref={pageBgRef}
        onClick={close}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-surface-page)', opacity: source ? 0 : 1, pointerEvents: interactive ? 'auto' : 'none' }}
      />

      {/* Surface qui morphe + clippe ; scroll interne du corps quand ouvert */}
      <div
        ref={surfRef}
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
          left: '50%',
          marginLeft: 'calc(min(720px, 100vw - 32px) * -0.5)',
          width: 'min(720px, calc(100vw - 32px))',
          maxHeight: 'calc(100lvh - (env(safe-area-inset-top, 0px) + 76px) - 24px)',
          transformOrigin: 'top left',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--nc-shadow-3)',
          borderRadius: source ? 16 : 24,
          overflowX: 'hidden',
          overflowY: interactive ? 'auto' : 'hidden',
          willChange: 'width, height, transform, border-radius',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
        {/* Contenu ENCADRÉ (header carte + corps Notion réel en children) */}
        <div ref={encRef} style={{ padding: 32, opacity: source ? 0 : 1, willChange: 'opacity' }}>
          <h1 ref={encTitleRef} style={{ ...H1_STYLE, opacity: 0, marginBottom: 16 }}>{resource?.titre}</h1>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>{resource?.description}</p>
          {resource && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>{formatDate(resource.dateCreation)}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ResourceBadge variant="ressource" label="Ressource" />
            {resource?.formation?.map((f) => <ResourceBadge key={f} variant="formation" label={f} />)}
            {resource?.type?.map((t) => <ResourceBadge key={t} variant="type" label={t} />)}
          </div>

          {/* CORPS NOTION RÉEL (RSC, Suspense) */}
          {children}
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '1px solid var(--color-border-default)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 2 }}
        >
          ✕
        </button>

        {/* Clone du CONTENU CARTE (départ) — réplique ResourceCard */}
        {resource && (
          <div
            ref={cardRef}
            style={{ position: 'absolute', top: 0, left: 0, width: source!.cardRect.width, padding: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, willChange: 'opacity', pointerEvents: 'none' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <ResourceBadge variant="ressource" label="Ressource" />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h3 ref={cardTitleRef} style={CARD_TITLE_STYLE}>{resource.titre}</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{resource.description}</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {resource.formation?.map((f) => <ResourceBadge key={f} variant="formation" label={f} />)}
              {resource.type?.map((t) => <ResourceBadge key={t} variant="type" label={t} />)}
            </div>
          </div>
        )}
      </div>

      {/* TITRE CONTINU (hero) */}
      {resource && (
        <h1 ref={heroRef} style={{ ...H1_STYLE, position: 'fixed', transformOrigin: 'top left', willChange: 'transform, opacity', pointerEvents: 'none' }}>
          {resource.titre}
        </h1>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
