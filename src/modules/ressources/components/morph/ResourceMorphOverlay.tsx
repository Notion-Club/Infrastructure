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
import type { Resource, Template } from '../../types';
import { SPRING_EASING, SPRING_DURATION } from '../../lib/spring';
import type { MorphSource } from './MorphSourceContext';

// Morph WAAPI (mécanique validée au lab v9) — surface clippée qui morphe (coins
// lisses), titre CONTINU (hero) qui voyage, fade-through à gap des contenus.
// Différence vs scaffold intercepté : la donnée (resource OU template) vient des
// props (déjà en mémoire, zéro fetch) et la fermeture est purement cliente
// (onClose après l'anim) — aucune navigation, la grille derrière reste montée.

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
  const surfRef = useRef<HTMLDivElement>(null);
  const encRef = useRef<HTMLDivElement>(null);
  const encTitleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardTitleRef = useRef<HTMLHeadingElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null);

  const gRef = useRef<{ surfFrom: Keyframe; surfTo: Keyframe; heroFrom: string } | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const closingRef = useRef(false);
  const poppedRef = useRef(false);
  const [interactive, setInteractive] = useState(false);

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

  // ── Fermeture (joue le morph inverse, puis finishClose) ────────────────────
  const startClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setInteractive(false);

    const g = gRef.current;
    const surf = surfRef.current;
    if (!g || !surf || prefersReduced()) return finishClose();

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

  // Verrou de scroll NON déplaçant : on fige l'overflow SANS `position: fixed`.
  // L'ancienne approche (position:fixed + top:-scrollY + scrollTo au démontage)
  // déplaçait le document → à la fermeture le scroll sautait en haut puis
  // revenait, et la BottomNav tressautait en PWA iOS (reflow du viewport/safe-area).
  // Ici la position de scroll n'est JAMAIS modifiée → la grille reste exactement
  // où elle était à la fermeture. `scrollRestoration: manual` empêche le
  // history.back() (bouton retour) de restaurer le scroll de l'entrée précédente
  // (qui ramenait en haut de page). Le fond de l'overlay reste figé via
  // overflow:hidden + touch-action sur le backdrop + overscroll-behavior sur la
  // surface (cf. styles).
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

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <div
        ref={pageBgRef}
        onClick={startClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-surface-page)', opacity: 0, pointerEvents: interactive ? 'auto' : 'none', touchAction: 'none' }}
      />

      {/* Surface qui morphe + clippe ; scroll interne du corps quand ouvert.
          C'est le DIALOGUE a11y : role/aria-modal/label + tabindex pour recevoir
          le focus à l'ouverture. */}
      <div
        ref={surfRef}
        role="dialog"
        aria-modal="true"
        aria-label={item.titre}
        tabIndex={-1}
        style={{
          outline: 'none',
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
          borderRadius: 16,
          overflowX: 'hidden',
          overflowY: interactive ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
          willChange: 'width, height, transform, border-radius',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
        {/* Contenu ENCADRÉ (header + corps réel, déjà en mémoire) */}
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

          {/* CORPS — source unique partagée avec la vraie page détail */}
          {resource && <ResourceContentBody resource={resource} />}
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

        <button
          type="button"
          onClick={startClose}
          aria-label="Fermer"
          style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '1px solid var(--color-border-default)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 2 }}
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

      {/* TITRE CONTINU (hero) */}
      <h1 ref={heroRef} style={{ ...H1_STYLE, position: 'fixed', transformOrigin: 'top left', willChange: 'transform, opacity', pointerEvents: 'none' }}>
        {item.titre}
      </h1>
    </div>
  );

  return createPortal(overlay, document.body);
}
