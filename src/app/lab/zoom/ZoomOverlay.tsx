'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
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

export interface ZoomOverlayHandle {
  close: () => void;
}

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Style partagé entre le titre de l'encadré (caché) et le titre ANCRÉ (visible,
// continu) — ils doivent être pixel-identiques pour que l'ancrage soit invisible.
const H1_STYLE: CSSProperties = {
  fontSize: 'clamp(32px, 7vw, 44px)',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: 'var(--color-text-primary)',
  margin: 0,
  lineHeight: 1.1,
};

export function ZoomOverlay({
  source,
  onClosed,
  handleRef,
}: {
  source: ZoomSource;
  onClosed: () => void;
  handleRef?: Ref<ZoomOverlayHandle>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null); // conteneur encadré → définit le rect cible
  const encTitleRef = useRef<HTMLHeadingElement>(null);
  const cardLayerRef = useRef<HTMLDivElement>(null);
  const encLayerRef = useRef<HTMLDivElement>(null);
  const anchorTitleRef = useRef<HTMLHeadingElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const geomRef = useRef<{ fromBox: string; fromTitle: string } | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const closingRef = useRef(false);
  const [interactive, setInteractive] = useState(false);

  const run = (
    el: Element | null,
    keyframes: Keyframe[],
    duration: number,
    easing: string,
  ): Animation | null => {
    if (!el) return null;
    const anim = el.animate(keyframes, { duration, easing, fill: 'both' });
    animsRef.current.push(anim);
    return anim;
  };

  // ── Ouverture ───────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const box = boxRef.current;
    const dest = destRef.current;
    const encTitle = encTitleRef.current;
    if (!box || !dest || !encTitle) return;

    const reduced = prefersReduced();
    const destRect = dest.getBoundingClientRect();
    const destTitleRect = encTitle.getBoundingClientRect();
    const destTitleFont = parseFloat(getComputedStyle(encTitle).fontSize) || 40;

    // Le clone (box) occupe le RECT CIBLE ; on le ramène au rect source par un
    // transform (FLIP), puis on anime le transform → identité (compositor only).
    box.style.top = `${destRect.top}px`;
    box.style.left = `${destRect.left}px`;
    box.style.width = `${destRect.width}px`;
    box.style.height = `${destRect.height}px`;

    const c = source.cardRect;
    const sx = c.width / destRect.width;
    const sy = c.height / destRect.height;
    const tx = c.left - destRect.left;
    const ty = c.top - destRect.top;
    const fromBox = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;

    // Titre ancré : posé au rect du H1 de l'encadré, ramené au titre source par
    // un scale UNIFORME (ratio de font-size → zéro distorsion du texte).
    const tt = source.titleRect;
    const tScale = source.titleFontSize / destTitleFont;
    const ttx = tt.left - destTitleRect.left;
    const tty = tt.top - destTitleRect.top;
    const fromTitle = `translate(${ttx}px, ${tty}px) scale(${tScale})`;

    anchorTitleRef.current!.style.top = `${destTitleRect.top}px`;
    anchorTitleRef.current!.style.left = `${destTitleRect.left}px`;
    anchorTitleRef.current!.style.width = `${destTitleRect.width}px`;

    geomRef.current = { fromBox, fromTitle };

    if (reduced) {
      // Pas de morph : fondu instantané vers l'état final.
      box.style.transform = 'none';
      box.style.borderRadius = 'var(--nc-radius-md)';
      run(backdropRef.current, [{ opacity: 0 }, { opacity: 1 }], 120, FADE_EASING);
      run(cardLayerRef.current, [{ opacity: 1 }, { opacity: 0 }], 120, FADE_EASING);
      run(encLayerRef.current, [{ opacity: 0 }, { opacity: 1 }], 160, FADE_EASING);
      anchorTitleRef.current!.style.opacity = '0';
      encTitle.style.opacity = '1';
      // Déféré (hors corps d'effet) pour ne pas déclencher de render en cascade.
      requestAnimationFrame(() => setInteractive(true));
      return;
    }

    // Conteneur : transform spring + border-radius 16 → 24.
    const boxAnim = run(
      box,
      [
        { transform: fromBox, borderRadius: '16px' },
        { transform: 'none', borderRadius: 'var(--nc-radius-md)' },
      ],
      SPRING_DURATION,
      SPRING_EASING,
    );

    // Titre ancré : spring, opaque tout du long (élément CONTINU anti-fantôme).
    run(
      anchorTitleRef.current,
      [{ transform: fromTitle }, { transform: 'none' }],
      SPRING_DURATION,
      SPRING_EASING,
    );

    // Cross-fade : contenu carte sort tôt (0→35 %), contenu encadré entre tard
    // (55→100 %). Scrim léger en fondu — la grille reste visible et IMMOBILE.
    run(backdropRef.current, [{ opacity: 0 }, { opacity: 1 }], SPRING_DURATION, FADE_EASING);
    run(
      cardLayerRef.current,
      [
        { opacity: 1, offset: 0 },
        { opacity: 0, offset: 0.35 },
        { opacity: 0, offset: 1 },
      ],
      SPRING_DURATION,
      FADE_EASING,
    );
    run(
      encLayerRef.current,
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: 0.55 },
        { opacity: 1, offset: 1 },
      ],
      SPRING_DURATION,
      FADE_EASING,
    );

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
    if (!geom || !box) {
      onClosed();
      return;
    }

    animsRef.current.forEach((a) => a.cancel());
    animsRef.current = [];

    if (prefersReduced()) {
      onClosed();
      return;
    }

    const boxAnim = run(
      box,
      [
        { transform: 'none', borderRadius: 'var(--nc-radius-md)' },
        { transform: geom.fromBox, borderRadius: '16px' },
      ],
      SPRING_DURATION,
      SPRING_EASING,
    );
    run(
      anchorTitleRef.current,
      [{ transform: 'none' }, { transform: geom.fromTitle }],
      SPRING_DURATION,
      SPRING_EASING,
    );
    run(backdropRef.current, [{ opacity: 1 }, { opacity: 0 }], SPRING_DURATION, FADE_EASING);
    run(
      encLayerRef.current,
      [
        { opacity: 1, offset: 0 },
        { opacity: 0, offset: 0.45 },
        { opacity: 0, offset: 1 },
      ],
      SPRING_DURATION,
      FADE_EASING,
    );
    run(
      cardLayerRef.current,
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: 0.55 },
        { opacity: 1, offset: 1 },
      ],
      SPRING_DURATION,
      FADE_EASING,
    );

    boxAnim?.finished.then(onClosed).catch(onClosed);
  }, [onClosed]);

  useImperativeHandle(handleRef, () => ({ close }), [close]);

  // Échap ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Nettoyage explicite des animations au démontage.
  useEffect(() => {
    return () => {
      animsRef.current.forEach((a) => a.cancel());
      animsRef.current = [];
    };
  }, []);

  const { resource } = source;

  const overlay = (
    <div
      aria-modal
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        // L'overlay lui-même ne capte rien : seuls le scrim et l'encadré le font.
        pointerEvents: 'none',
      }}
    >
      {/* Scrim — fond léger, la grille reste visible/immobile derrière */}
      <div
        ref={backdropRef}
        onClick={close}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 8, 8, 0.18)',
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
        <div
          ref={encLayerRef}
          style={{
            padding: 32,
            opacity: 0,
            pointerEvents: interactive ? 'auto' : 'none',
          }}
        >
          {/* H1 réel : caché (opacity 0) — le titre ANCRÉ le recouvre. Garde le
              layout pour que la description coule au bon endroit. */}
          <h1 ref={encTitleRef} style={{ ...H1_STYLE, opacity: 0, marginBottom: 16 }}>
            {resource.titre}
          </h1>
          <p
            style={{
              fontSize: 16,
              color: 'var(--color-text-secondary)',
              margin: '0 0 16px',
              lineHeight: 1.6,
            }}
          >
            {resource.description}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            <LabBadge kind="ressource" label="Ressource" />
            <LabBadge kind="formation" label={resource.formation} />
            <LabBadge kind="type" label={resource.type} />
          </div>
          <hr
            style={{
              border: 'none',
              borderTop: '1px solid var(--color-border-default)',
              margin: '0 0 24px',
            }}
          />
          <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: '0 0 16px' }}>
            Aperçu mocké du contenu de la ressource. Le morph valide la continuité
            de la carte vers cet encadré : le titre est ancré, le reste fait un
            cross-fade temporisé, et la grille derrière ne bouge pas.
          </p>
          <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
            Ferme avec la croix, le scrim ou Échap — la fermeture est symétrique.
          </p>

          {/* Bouton fermer */}
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

      {/* Couche CONTENU CARTE — au rect source, sort tôt (0→35 %) */}
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
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              margin: '40px 0 0',
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

      {/* Titre ANCRÉ — élément continu, opaque tout du long */}
      <h1
        ref={anchorTitleRef}
        style={{
          ...H1_STYLE,
          position: 'fixed',
          transformOrigin: 'top left',
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      >
        {resource.titre}
      </h1>
    </div>
  );

  return createPortal(overlay, document.body);
}
