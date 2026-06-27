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

// Material « container transform → fade-through » :
//  - le CONTENEUR (surface) morphe (width/height/radius) ;
//  - les contenus sont à leur taille NATURELLE (jamais agrandis) et se relaient
//    en cross-fade SÉQUENTIEL à easing LINÉAIRE (sortant 100→0, PUIS entrant
//    0→100) → jamais deux textes visibles ensemble ;
//  - chaque contenu se contente de TRANSLATER pour suivre la surface.
// Réf. m3.material.io/styles/motion/transitions + material-components-android.
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
  const cardRef = useRef<HTMLDivElement>(null);

  const gRef = useRef<{ surfFrom: Keyframe; surfTo: Keyframe; track: string; cardOut: string } | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const closingRef = useRef(false);
  const [interactive, setInteractive] = useState(false);

  // ── Ouverture ───────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const surf = surfRef.current;
    const enc = encRef.current;
    const card = cardRef.current;
    const pageBg = pageBgRef.current;
    if (!surf || !enc || !card) return;

    const store = animsRef.current;
    const d = SPRING_DURATION;
    const c = source.cardRect;

    // Cible mesurée (encRef à l'identité, taille NATURELLE de la page).
    const destRect = enc.getBoundingClientRect();
    const dx = c.left - destRect.left;
    const dy = c.top - destRect.top;

    // Surface VIDE : width/height/translate/radius (PAS de scale → coins lisses).
    surf.style.top = `${destRect.top}px`;
    surf.style.left = `${destRect.left}px`;
    const surfFrom: Keyframe = {
      transform: `translate(${dx}px, ${dy}px)`,
      width: `${c.width}px`,
      height: `${c.height}px`,
      borderRadius: '16px',
    };
    const surfTo: Keyframe = { transform: 'none', width: `${destRect.width}px`, height: `${destRect.height}px`, borderRadius: '24px' };
    Object.assign(surf.style, surfFrom);

    // Les deux contenus suivent la surface par simple TRANSLATE (zéro scale du texte).
    // - encadré : posé à la cible, parti depuis le coin de la carte → identité.
    // - carte : posée au coin de la carte → translatée vers le coin de la cible.
    const track = `translate(${dx}px, ${dy}px)`; // coin carte (depuis la cible)
    const cardOut = `translate(${-dx}px, ${-dy}px)`; // coin cible (depuis la carte)
    enc.style.transform = track;

    gRef.current = { surfFrom, surfTo, track, cardOut };

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
      Object.assign(surf.style, surfTo);
      if (pageBg) pageBg.style.opacity = '1';
      enc.style.transform = 'none';
      enc.style.opacity = '1';
      card.style.opacity = '0';
      requestAnimationFrame(() => setInteractive(true));
      return;
    }

    // Fond opaque QUASI-IMMÉDIAT → l'index passe derrière la page.
    anim(pageBg, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 1 }], d, FADE, store);

    // Surface : ressort SANS overshoot, coins lisses.
    const surfAnim = anim(surf, [surfFrom, surfTo], d, SPRING_EASING, store);

    // Contenu CARTE (sortant) : suit la surface, disparaît ENTIÈREMENT tôt (linéaire).
    // Keyframes opacité SPANNÉES jusqu'à offset 1 → la valeur finale (0) TIENT
    // (sinon WAAPI revient vers la base au-delà du dernier offset → le contenu
    // réapparaissait à l'état ouvert).
    anim(card, [{ transform: 'none' }, { transform: cardOut }], d, SPRING_EASING, store);
    anim(card, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0, offset: 0.4 }, { opacity: 0, offset: 1 }], d, FADE, store);

    // Contenu ENCADRÉ (entrant) : transparent au départ, entre APRÈS (zéro chevauchement).
    anim(enc, [{ transform: track }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(enc, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1, offset: 0.85 }, { opacity: 1, offset: 1 }], d, FADE, store);

    surfAnim?.finished.then(() => setInteractive(true)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fermeture (symétrique) ──────────────────────────────────────────────
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
    // Encadré (sortant) : disparaît DÈS LE DÉPART, entièrement.
    anim(encRef.current, [{ transform: 'none' }, { transform: g.track }], d, SPRING_EASING, store);
    anim(encRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 0, offset: 1 }], d, FADE, store);
    // Carte (entrante) : revient EN FIN (après disparition de l'encadré).
    anim(cardRef.current, [{ transform: g.cardOut }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(cardRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1, offset: 0.95 }, { opacity: 1, offset: 1 }], d, FADE, store);
    // Fond : se retire en fin → l'index réapparaît quand la carte rentre.
    anim(pageBgRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 1 }], d, FADE, store);

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
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--color-surface-page)',
          opacity: 0,
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      />

      {/* Surface VIDE qui morphe (container) */}
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

      {/* Contenu ENCADRÉ — taille NATURELLE (jamais agrandie) */}
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
        <h1 style={{ ...H1_STYLE, marginBottom: 14 }}>{resource.titre}</h1>
        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
          {resource.description}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          <LabBadge kind="ressource" label="Ressource" />
          <LabBadge kind="formation" label={resource.formation} />
          <LabBadge kind="type" label={resource.type} />
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: '0 0 22px' }} />
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: '0 0 14px' }}>
          Aperçu mocké : container transform « fade-through ». La surface morphe,
          les contenus se relaient à leur taille naturelle, jamais superposés.
        </p>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Ferme avec la croix, le fond ou Échap.
        </p>

        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
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

      {/* Contenu CARTE — taille NATURELLE, suit la surface, sort en premier */}
      <div
        ref={cardRef}
        data-debug="card-content"
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
    </div>
  );

  return createPortal(overlay, document.body);
}
