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

// Transport du contenu carte (état OUVERT) : translate vers le rect cible
// (mesuré sur la boîte) + scale UNIFORME (zéro distorsion du texte).
function cardOpenTransform(box: HTMLElement, c: DOMRect): string {
  const r = box.getBoundingClientRect();
  const k = r.width / c.width;
  return `translate(${r.left - c.left}px, ${r.top - c.top}px) scale(${k})`;
}

export function ZoomOverlay({
  source,
  onClosed,
}: {
  source: ZoomSource;
  onClosed: () => void;
}) {
  const pageBgRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null); // surface qui morphe + contient l'encadré
  const encRef = useRef<HTMLDivElement>(null); // contenu encadré (enfant → scale avec la boîte)
  const encTitleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null); // contenu carte transporté
  const cardTitleRef = useRef<HTMLHeadingElement>(null); // titre carte (cross-fade rapide ↔ hero)
  const heroRef = useRef<HTMLHeadingElement>(null); // titre ancré continu

  const geomRef = useRef<{ fromBox: string; fromTitle: string } | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const closingRef = useRef(false);
  const [interactive, setInteractive] = useState(false);

  // ── Ouverture ───────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const box = boxRef.current;
    const enc = encRef.current;
    const encTitle = encTitleRef.current;
    const hero = heroRef.current;
    const card = cardRef.current;
    const pageBg = pageBgRef.current;
    if (!box || !enc || !encTitle || !hero || !card) return;

    const store = animsRef.current;
    const d = SPRING_DURATION;

    // 1) Mesures pendant que la boîte est CENTRÉE (avant tout transform FLIP).
    const destRect = box.getBoundingClientRect();
    const destTitleRect = encTitle.getBoundingClientRect();
    const destTitleFont = parseFloat(getComputedStyle(encTitle).fontSize) || 40;

    // 2) Fige la boîte en px + origine top-left pour le FLIP.
    box.style.top = `${destRect.top}px`;
    box.style.left = `${destRect.left}px`;
    box.style.width = `${destRect.width}px`;
    box.style.height = `${destRect.height}px`;
    box.style.transformOrigin = 'top left';

    const c = source.cardRect;
    const sx = c.width / destRect.width;
    const sy = c.height / destRect.height;
    const fromBox = `translate(${c.left - destRect.left}px, ${c.top - destRect.top}px) scale(${sx}, ${sy})`;
    box.style.transform = fromBox; // état initial avant l'anim (zéro flash)

    // Titre ancré : layout encadré, ramené au titre carte (scale uniforme).
    const tt = source.titleRect;
    const tScale = source.titleFontSize / destTitleFont;
    const fromTitle = `translate(${tt.left - destTitleRect.left}px, ${tt.top - destTitleRect.top}px) scale(${tScale})`;
    hero.style.top = `${destTitleRect.top}px`;
    hero.style.left = `${destTitleRect.left}px`;
    hero.style.width = `${destTitleRect.width}px`;
    hero.style.transform = fromTitle;

    const toCard = cardOpenTransform(box, c);
    geomRef.current = { fromBox, fromTitle };

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
      box.style.transform = 'none';
      box.style.borderRadius = 'var(--nc-radius-md)';
      if (pageBg) pageBg.style.opacity = '1';
      enc.style.opacity = '1';
      card.style.opacity = '0';
      hero.style.transform = 'none';
      requestAnimationFrame(() => setInteractive(true));
      return;
    }

    // Fond opaque QUASI-IMMÉDIAT → l'index passe derrière la page qui s'ouvre.
    anim(pageBg, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 1 }], d, FADE_IN_EASING, store);

    // Boîte : FLIP non-uniforme + radius, ressort SANS overshoot.
    const boxAnim = anim(
      box,
      [{ transform: fromBox, borderRadius: '16px' }, { transform: 'none', borderRadius: 'var(--nc-radius-md)' }],
      d,
      SPRING_EASING,
      store,
    );

    // Contenu encadré (enfant) : scale avec la boîte, entre en fondu tardif.
    anim(enc, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1, offset: 1 }], d, FADE_IN_EASING, store);

    // Contenu carte : transporté (grandit + monte). Les EXTRAS (badges/desc)
    // restent visibles pendant le scale ; le TITRE s'efface vite (cross-fade hero).
    anim(card, [{ transform: 'none' }, { transform: toCard }], d, SPRING_EASING, store);
    anim(card, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0, offset: 0.6 }], d, FADE_OUT_EASING, store);
    anim(cardTitleRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.16 }], d, FADE_OUT_EASING, store);

    // Titre ancré : ressort continu (handoff rapide depuis le titre carte).
    anim(hero, [{ transform: fromTitle }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(hero, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.16 }, { opacity: 1, offset: 1 }], d, FADE_IN_EASING, store);

    boxAnim?.finished.then(() => setInteractive(true)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fermeture (symétrique, contenu synchro dès le départ) ───────────────
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setInteractive(false);

    const geom = geomRef.current;
    const box = boxRef.current;
    if (!geom || !box) return onClosed();
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
    const toCard = cardOpenTransform(box, source.cardRect);

    const boxAnim = anim(
      box,
      [{ transform: 'none', borderRadius: 'var(--nc-radius-md)' }, { transform: geom.fromBox, borderRadius: '16px' }],
      d,
      SPRING_EASING,
      store,
    );
    // Contenu encadré : disparaît DÈS LE DÉPART (ease-out), réduit avec la boîte.
    anim(encRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 0, offset: 1 }], d, FADE_OUT_EASING, store);
    // Fond de page : se retire en fin → l'index réapparaît quand la carte rentre.
    anim(pageBgRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0, offset: 1 }], d, FADE_OUT_EASING, store);
    // Contenu carte : revient en toute fin → atterrissage pixel-exact sur la grille.
    anim(cardRef.current, [{ transform: toCard }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(cardRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 1 }], d, FADE_IN_EASING, store);
    anim(cardTitleRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.84 }, { opacity: 1, offset: 1 }], d, FADE_IN_EASING, store);
    // Titre ancré : revient, fond en toute fin (le titre carte prend le relais).
    anim(heroRef.current, [{ transform: 'none' }, { transform: geom.fromTitle }], d, SPRING_EASING, store);
    anim(heroRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.8 }, { opacity: 0, offset: 1 }], d, FADE_OUT_EASING, store);

    boxAnim?.finished.then(onClosed).catch(onClosed);
  }, [onClosed, source.cardRect]);

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
      {/* Fond de PAGE opaque (réplique .nc-app-bg) — couvre l'index */}
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

      {/* Boîte = surface qui morphe + CONTIENT l'encadré (scale ensemble) */}
      <div
        ref={boxRef}
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(720px, calc(100vw - 32px))',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--nc-shadow-3)',
          borderRadius: 16,
          overflow: 'hidden',
          willChange: 'transform, border-radius',
          pointerEvents: 'none',
        }}
      >
        <div ref={encRef} style={{ padding: 32, opacity: 0, pointerEvents: interactive ? 'auto' : 'none' }}>
          {/* H1 réel caché — le titre ANCRÉ le recouvre, mais garde le layout */}
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
            Aperçu mocké : la carte est transportée vers cette page. Le contenu
            grandit et se réduit AVEC la surface, l’index passe derrière, et rien
            ne rebondit une fois la cible atteinte.
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
      </div>

      {/* Contenu CARTE transporté (titre carte + badges + desc) */}
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

      {/* Titre ANCRÉ continu */}
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
