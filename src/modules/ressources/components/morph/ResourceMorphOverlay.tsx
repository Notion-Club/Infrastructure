'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { flushSync } from 'react-dom';
import { ResourceBadge } from '../shared/ResourceBadge';
import { CapabilityLock } from '../shared/CapabilityLock';
import { TellaEmbed } from '../shared/TellaEmbed';
import { ResourceContentBody } from '../shared/ResourceContentBody';
import { canAccess } from '../../lib/access';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { getResourceBody } from '../../server/getResourceBody';
import type { Resource, Template, ResourceItem, NotionBlock } from '../../types';
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
//
// GESTES (ajout) — l'overlay reste monté toute la session d'ouverture et NAVIGUE
// en interne (index dans la liste visible figée) :
//   • Swipe HORIZONTAL → ressource/template ±1 (carrousel « Tinder » : la surface
//     suit le doigt, le voisin pré-monté en skeleton arrive à côté et prend sa
//     place ; butée élastique aux extrémités).
//   • Pull VERTICAL au bord (haut→bas en haut de page, bas→haut en bas de page) →
//     fermeture par le MÊME morph retour carte (vers la carte de l'item COURANT).
// Un seul reconnaisseur verrouille l'axe après quelques px ; hors bord, le scroll
// vertical natif reste intact.

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

// Habillage visuel de l'encadré — partagé entre la surface réelle et le panneau
// voisin (fantôme) du carrousel → parité pixel au moment du swap.
const SURFACE_BOX_STYLE: CSSProperties = {
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-border-default)',
  boxShadow: 'var(--nc-shadow-3)',
  borderRadius: 24,
  overflow: 'hidden',
  position: 'relative',
};

// ── Réglages gestes ─────────────────────────────────────────────────────────
const PANEL_GAP = 16; // écart entre panneaux du carrousel
const AXIS_LOCK = 10; // px parcourus avant de verrouiller l'axe du geste
const H_COMMIT_RATIO = 0.3; // fraction de largeur pour valider un swipe horizontal
const H_COMMIT_VELOCITY = 0.5; // px/ms — vélocité de « flick » horizontal
const V_CLOSE_DISTANCE = 100; // px de pull vertical pour déclencher la fermeture
const V_CLOSE_VELOCITY = 0.5; // px/ms — vélocité de « flick » vertical
const EDGE_RESIST = 0.35; // résistance élastique (bornes horizontales + pull)

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

// Rects (carte + titre) d'un item lus EN LIVE dans la grille (toutes les cartes
// restent montées, `data-card-id`) → point d'arrivée du morph de fermeture après
// navigation au swipe.
function measureCardRects(slug: string): { cardRect: DOMRect; titleRect: DOMRect } | null {
  if (typeof document === 'undefined') return null;
  let wrap: HTMLElement | null = null;
  try {
    wrap = document.querySelector<HTMLElement>(`.nc-grid-card[data-card-id="${CSS.escape(slug)}"]`);
  } catch {
    wrap = null;
  }
  if (!wrap) return null;
  const box = wrap.querySelector<HTMLElement>('a > div') ?? wrap;
  const title = wrap.querySelector<HTMLElement>('h3') ?? box;
  return { cardRect: box.getBoundingClientRect(), titleRect: title.getBoundingClientRect() };
}

// ── Contenu ENCADRÉ (header + corps réel) — factorisé pour être partagé par la
// surface réelle ET le panneau voisin du carrousel (parité pixel au swap). ────
interface EncContentProps {
  item: ResourceItem;
  body: NotionBlock[] | null;
  startedEmpty: boolean;
  contentIn: boolean;
  reduced: boolean;
  visible: boolean;
  encRef?: React.Ref<HTMLDivElement>;
  encTitleRef?: React.Ref<HTMLHeadingElement>;
}
function EncContent({ item, body, startedEmpty, contentIn, reduced, visible, encRef, encTitleRef }: EncContentProps) {
  const isResource = item.category === 'resource';
  const resource = isResource ? (item as Resource) : null;
  const template = isResource ? null : (item as Template);
  const hasAccess = canAccess(mockCurrentUser.capability, item.visibilite);
  const badgeVariant = isResource ? 'ressource' : 'template';
  const badgeLabel = isResource ? 'Ressource' : 'Template';

  return (
    <div ref={encRef} style={{ padding: 32, opacity: visible ? 1 : 0, willChange: 'opacity' }}>
      <h1 ref={encTitleRef} style={{ ...H1_STYLE, opacity: visible ? 1 : 0, marginBottom: 16 }}>{item.titre}</h1>
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
            <ResourceContentBody resource={body ? { ...resource, content: body } : resource} />
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
  );
}

interface OverlayProps {
  source: MorphSource;
  /** Liste ordonnée visible (figée à l'ouverture) — base du swipe ±1. */
  items: ResourceItem[];
  /** Index de départ (item cliqué) dans `items`. */
  initialIndex: number;
  /** Appelé UNE fois l'animation de fermeture terminée → le provider démonte. */
  onClose: () => void;
}

export function ResourceMorphOverlay({ source, items, initialIndex, onClose }: OverlayProps) {
  // Item COURANT — navigable au swipe (l'overlay ne se remonte jamais pendant la
  // session : seul `index` change).
  const [index, setIndex] = useState(initialIndex);
  const item = items[index] ?? source.item;
  const isResource = item.category === 'resource';
  const resource = isResource ? (item as Resource) : null;
  const template = isResource ? null : (item as Template);
  const hasAccess = canAccess(mockCurrentUser.capability, item.visibilite);

  const pageBgRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<HTMLDivElement>(null);
  const encRef = useRef<HTMLDivElement>(null);
  const encTitleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardTitleRef = useRef<HTMLHeadingElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null);

  const gRef = useRef<MorphGeom | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const pageBgAnimRef = useRef<Animation | null>(null);
  const closingRef = useRef(false);
  const poppedRef = useRef(false);
  const [interactive, setInteractive] = useState(false);
  // Ghost = panneau voisin monté à la volée pendant un drag horizontal. Il porte
  // son PROPRE item (snapshot) → il ne change pas quand `index` change au swap.
  // Déclaré ici (au-dessus de startClose qui le remet à null) pour éviter tout
  // accès avant déclaration.
  const [ghost, setGhost] = useState<{ dir: 1 | -1; item: ResourceItem } | null>(null);

  // ── Corps Notion, cache par slug + pré-chargement des voisins ±1 ────────────
  // La liste porte les headers (titre/desc/badges) mais généralement PAS le corps
  // (`content` vide) → on le charge via la Server Action et on met en cache. À
  // l'ouverture ET à chaque navigation on pré-charge l'item courant + ses voisins
  // → le panneau qui arrive affiche skeleton puis contenu sans attente.
  // Cache en STATE (lu au render → conforme react-hooks/refs). `inFlight` reste en
  // ref (lu seulement dans des callbacks, jamais au render).
  const [bodyCache, setBodyCache] = useState<Record<string, NotionBlock[]>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  const bodyFor = useCallback(
    (it: ResourceItem): NotionBlock[] | null => {
      if (it.category !== 'resource') return null; // templates : pas de corps async
      if (it.content.length > 0) return it.content; // déjà fourni
      return bodyCache[it.slug] ?? null; // null = en chargement
    },
    [bodyCache],
  );

  const ensureBody = useCallback(
    (it: ResourceItem | undefined) => {
      if (!it || it.category !== 'resource') return;
      if (!canAccess(mockCurrentUser.capability, it.visibilite)) return; // verrouillé
      if (it.content.length > 0) return;
      if (bodyCache[it.slug]) return;
      if (inFlightRef.current.has(it.slug)) return;
      const slug = it.slug;
      inFlightRef.current.add(slug);
      getResourceBody(slug)
        .then((blocks) => setBodyCache((c) => ({ ...c, [slug]: blocks })))
        .catch(() => setBodyCache((c) => ({ ...c, [slug]: [] })))
        .finally(() => inFlightRef.current.delete(slug));
    },
    [bodyCache],
  );

  // Pré-charge courant + voisins à chaque changement d'index.
  useEffect(() => {
    ensureBody(items[index]);
    ensureBody(items[index - 1]);
    ensureBody(items[index + 1]);
  }, [index, items, ensureBody]);

  const body = useMemo(() => bodyFor(item), [bodyFor, item]);
  const startedEmpty = !!resource && hasAccess && resource.content.length === 0;
  const [reduced] = useState(prefersReduced);
  // Reveal dérivé du slug révélé (pas de reset en effet) : `contentIn` est vrai
  // uniquement pour l'item dont le corps a fini d'apparaître → à la navigation il
  // repasse faux tout seul (nouveau slug).
  const [revealedSlug, setRevealedSlug] = useState<string | null>(null);
  const contentIn = revealedSlug === item.slug;
  const skelHRef = useRef<number | null>(null);

  // Mémorise la hauteur du skeleton tant que le corps n'est pas arrivé.
  useLayoutEffect(() => {
    if (body === null && surfRef.current) skelHRef.current = surfRef.current.offsetHeight;
  });

  // À l'arrivée du corps : tween de la hauteur skeleton → contenu.
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
  // setState dans un rAF (async) → non concerné par set-state-in-effect.
  useEffect(() => {
    if (body === null || !interactive || !startedEmpty || reduced) return;
    const slug = item.slug;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setRevealedSlug(slug)));
    return () => cancelAnimationFrame(id);
  }, [body, interactive, reduced, startedEmpty, item.slug]);

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
  // `pullY` (optionnel) : la surface a été tirée de `pullY` px par un pull vertical
  // → on démarre le morph inverse DEPUIS cette position (aucun saut).
  const startClose = useCallback(
    (pullY = 0) => {
      if (closingRef.current) return;
      closingRef.current = true;
      setInteractive(false);
      setGhost(null); // pas de voisin monté pendant le morph de fermeture

      const g = gRef.current;
      const surf = surfRef.current;
      const track = trackRef.current;
      if (!g || !surf || prefersReduced()) return finishClose();

      // La piste ne doit être NI positionnée (`relative`) NI transformée pendant le
      // morph : les deux en font un bloc conteneur qui PIÈGE le `position: fixed` de
      // la surface en PWA iOS → fermeture qui rétrécit hors écran (bug #258). On la
      // remet en `static`/`none` SYNCHRONEMENT, avant toute mesure.
      if (track) {
        track.style.transition = 'none';
        track.style.transform = 'none';
        track.style.willChange = '';
        track.style.position = 'static';
      }

      // Dé-piège la surface AVANT de la ré-ancrer, SYNCHRONEMENT (cf. #258 + PWA
      // iOS : le layer momentum d'un scroller ancre le fixed au CONTENU, pas au
      // viewport → rétrécissement invisible). On coupe le momentum, on remet en
      // haut, on gèle l'overflow, on flush.
      const scroller = scrollRef.current;
      if (scroller) {
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

      // AUTO-CORRECTION anti-piège (PWA iOS) — mesurée transform NEUTRE (avant
      // d'appliquer l'éventuel offset de pull), sinon on compenserait le pull.
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

      const fromTf = pullY ? `translateY(${pullY}px)` : 'none';
      const bgStart = pageBgRef.current
        ? parseFloat(getComputedStyle(pageBgRef.current).opacity) || 1
        : 1;

      const surfAnim = anim(surf, [{ ...g.surfTo, transform: fromTf }, g.surfFrom], d, SPRING_EASING, store);
      anim(encRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.28 }, { opacity: 0, offset: 1 }], d, FADE, store);
      anim(cardRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.84 }, { opacity: 1, offset: 1 }], d, FADE, store);
      anim(pageBgRef.current, [{ opacity: bgStart, offset: 0 }, { opacity: bgStart, offset: 0.5 }, { opacity: 0, offset: 1 }], d, FADE, store);
      anim(hero, [{ transform: fromTf }, { transform: g.heroFrom }], d, SPRING_EASING, store);
      anim(hero, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.6 }, { opacity: 0, offset: 0.8 }, { opacity: 0, offset: 1 }], d, FADE, store);
      anim(cardTitleRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.86 }, { opacity: 1, offset: 1 }], d, FADE, store);

      surfAnim?.finished.then(finishClose).catch(finishClose);
    },
    [finishClose],
  );

  // ── Construit la géométrie de morph (open + close) depuis la position EN FLUX
  // de la surface au repos (scroll 0) et les rects LIVE de la carte de `slug`.
  // Utilisé pour recalculer `gRef` après une navigation au swipe → la fermeture
  // morphe vers la BONNE carte. Renvoie null si la carte est introuvable. ──────
  const computeGeomForSlug = useCallback((slug: string): MorphGeom | null => {
    const surf = surfRef.current;
    const encTitle = encTitleRef.current;
    const cardTitle = cardTitleRef.current;
    if (!surf || !encTitle) return null;
    const rects = measureCardRects(slug);
    if (!rects) return null;

    const flowRect = surf.getBoundingClientRect();
    const encTitleRect = encTitle.getBoundingClientRect();
    const destFont = parseFloat(getComputedStyle(encTitle).fontSize) || 36;
    const cardFont = (cardTitle && parseFloat(getComputedStyle(cardTitle).fontSize)) || 15;
    const openH = Math.min(flowRect.height, window.innerHeight - flowRect.top - 24);

    const c = rects.cardRect;
    const dx = c.left - flowRect.left;
    const dy = c.top - flowRect.top;
    const surfFrom: Keyframe = { transform: `translate(${dx}px, ${dy}px)`, width: `${c.width}px`, height: `${c.height}px`, borderRadius: '16px' };
    const surfTo: Keyframe = { transform: 'none', width: `${flowRect.width}px`, height: `${openH}px`, borderRadius: '24px' };
    const hScale = cardFont / destFont;
    const heroFrom = `translate(${rects.titleRect.left - encTitleRect.left}px, ${rects.titleRect.top - encTitleRect.top}px) scale(${hScale})`;

    return {
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
  }, []);

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

    // État de repos (flux) posé en inline AVANT toute mesure.
    surf.style.position = 'relative';
    surf.style.width = SURF_WIDTH;
    surf.style.height = 'auto';
    surf.style.borderRadius = '24px';
    surf.style.overflow = 'hidden';

    const flowRect = surf.getBoundingClientRect();
    const encTitleRect = encTitle.getBoundingClientRect();
    const gridTitleRect = source.titleRect;
    const destFont = parseFloat(getComputedStyle(encTitle).fontSize) || 36;
    const cardFont = parseFloat(getComputedStyle(cardTitle).fontSize) || 15;

    const openH = Math.min(flowRect.height, window.innerHeight - flowRect.top - 24);

    const dx = c.left - flowRect.left;
    const dy = c.top - flowRect.top;

    // Passage en fixed pour le morph (géométrie au pixel).
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

    // Relâche la surface en flux (fin d'ouverture).
    const release = () => {
      const s = surfRef.current;
      if (s) {
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
      if (encRef.current) encRef.current.style.width = '';
      // Le pageBg est figé en INLINE (opacity 1) et son anim d'ouverture retirée →
      // il devient librement mutable (nécessaire au fade du pull vertical, sinon
      // l'anim `fill:both` d'ouverture le retiendrait à 1).
      const bgAnim = pageBgAnimRef.current;
      if (bgAnim) {
        try {
          bgAnim.commitStyles();
        } catch {
          /* noop */
        }
        bgAnim.cancel();
        pageBgAnimRef.current = null;
      }
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

    pageBgAnimRef.current = anim(pageBg, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 1 }], d, FADE, store);
    const surfAnim = anim(surf, [surfFrom, surfTo], d, SPRING_EASING, store);
    anim(card, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0, offset: 0.32 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(enc, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.85 }, { opacity: 1, offset: 1 }], d, FADE, store);
    anim(cardTitle, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.07 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(hero, [{ transform: heroFrom }, { transform: 'none' }], d, SPRING_EASING, store);
    anim(hero, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.22 }, { opacity: 1, offset: 1 }], d, FADE, store);

    surfAnim?.finished
      .then(() => {
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

  // ── Après une NAVIGATION : remet le scroll en haut + recalcule la géométrie de
  // fermeture sur la carte de l'item courant. (Skip au 1er montage : l'ouverture
  // s'en charge.) ─────────────────────────────────────────────────────────────
  const firstIndexRef = useRef(true);
  useLayoutEffect(() => {
    if (firstIndexRef.current) {
      firstIndexRef.current = false;
      return;
    }
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = 0;
    const g = computeGeomForSlug(item.slug);
    if (g) gRef.current = g;
  }, [index, item.slug, computeGeomForSlug]);

  // ── Navigation au swipe + pull-to-close (un seul reconnaisseur tactile) ─────
  const gestureBusyRef = useRef(false); // anim de commit/revert en cours

  useEffect(() => {
    const scroller = scrollRef.current;
    const track = trackRef.current;
    const surf = surfRef.current;
    const pageBg = pageBgRef.current;
    if (!scroller || !track || !surf) return;
    if (!interactive || reduced) return; // gestes seulement une fois ouvert

    const atTop = () => scroller.scrollTop <= 0;
    const atBottom = () => scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;

    type Drag = {
      x0: number; y0: number;
      axis: 'h' | 'v' | null;
      dir: 1 | -1;
      hasNeighbor: boolean;
      pullMode: 'down' | 'up' | null;
      panelW: number;
      lastX: number; lastY: number; lastT: number;
      vx: number; vy: number;
      curMove: number; // dernière valeur appliquée (translateX piste OU translateY surface)
    };
    let g: Drag | null = null;

    const clearTrack = () => {
      track.style.transition = 'none';
      track.style.transform = 'none'; // `none`, pas `0px` → pas de containing-block
      track.style.willChange = '';
    };

    const commitCarousel = (dir: 1 | -1, panelW: number, fromX: number) => {
      gestureBusyRef.current = true;
      const target = -dir * (panelW + PANEL_GAP);
      const a = track.animate(
        [{ transform: `translateX(${fromX}px)` }, { transform: `translateX(${target}px)` }],
        { duration: SPRING_DURATION, easing: SPRING_EASING, fill: 'both' },
      );
      const nextSlug = items[Math.min(items.length - 1, Math.max(0, index + dir))]?.slug;
      a.finished
        .then(() => {
          // Swap sans couture : on bascule l'item de la surface (flushSync) PENDANT
          // que la piste est encore décalée (surface hors écran, ghost au centre —
          // même item), PUIS on remet la piste à `none` (surface au centre, ghost
          // hors écran) : le centre montre le MÊME item avant/après → aucun flash.
          flushSync(() => setIndex((i) => Math.min(items.length - 1, Math.max(0, i + dir))));
          clearTrack();
          try {
            a.cancel();
          } catch {
            /* noop */
          }
          setGhost(null);
          gestureBusyRef.current = false;
          // Recalcule la géométrie de fermeture MAINTENANT que la piste est à `none`
          // (surface recentrée, non transformée) → l'effet de layout de navigation
          // l'avait calculée pendant que la surface était encore décalée. On lit la
          // position réelle et on écrase avec la bonne valeur.
          if (nextSlug) {
            const gm = computeGeomForSlug(nextSlug);
            if (gm) gRef.current = gm;
          }
        })
        .catch(() => {
          clearTrack();
          setGhost(null);
          gestureBusyRef.current = false;
        });
    };

    const revertCarousel = (fromX: number) => {
      gestureBusyRef.current = true;
      const a = track.animate(
        [{ transform: `translateX(${fromX}px)` }, { transform: 'translateX(0px)' }],
        { duration: 320, easing: SPRING_EASING, fill: 'both' },
      );
      const done = () => {
        clearTrack();
        try {
          a.cancel();
        } catch {
          /* noop */
        }
        setGhost(null);
        gestureBusyRef.current = false;
      };
      a.finished.then(done).catch(done);
    };

    const revertPull = (fromY: number) => {
      gestureBusyRef.current = true;
      const sa = surf.animate(
        [{ transform: `translateY(${fromY}px)` }, { transform: 'translateY(0px)' }],
        { duration: 340, easing: SPRING_EASING, fill: 'both' },
      );
      if (pageBg) {
        const cur = parseFloat(getComputedStyle(pageBg).opacity) || 1;
        pageBg.animate([{ opacity: cur }, { opacity: 1 }], { duration: 340, easing: SPRING_EASING });
      }
      const done = () => {
        surf.style.transform = 'none';
        if (pageBg) pageBg.style.opacity = '1';
        try {
          sa.cancel();
        } catch {
          /* noop */
        }
        gestureBusyRef.current = false;
      };
      sa.finished.then(done).catch(done);
    };

    const onStart = (e: TouchEvent) => {
      if (closingRef.current || gestureBusyRef.current) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      // Gestes uniquement si le doigt part SUR la surface (le fond garde son
      // tap-to-close via les pointer events).
      if (!surf.contains(t.target as Node)) {
        g = null;
        return;
      }
      g = {
        x0: t.clientX, y0: t.clientY,
        axis: null, dir: 1, hasNeighbor: false, pullMode: null,
        panelW: track.offsetWidth || surf.offsetWidth,
        lastX: t.clientX, lastY: t.clientY, lastT: e.timeStamp,
        vx: 0, vy: 0, curMove: 0,
      };
    };

    const onMove = (e: TouchEvent) => {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;

      if (!g.axis) {
        if (Math.hypot(dx, dy) < AXIS_LOCK) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          g.axis = 'h';
          g.dir = dx < 0 ? 1 : -1; // gauche → suivant, droite → précédent
          const nb = index + g.dir;
          g.hasNeighbor = nb >= 0 && nb < items.length;
          if (g.hasNeighbor) setGhost({ dir: g.dir, item: items[nb] });
        } else {
          const pullDown = atTop() && dy > 0;
          const pullUp = atBottom() && dy < 0;
          g.pullMode = pullDown ? 'down' : pullUp ? 'up' : null;
          g.axis = 'v';
          if (!g.pullMode) {
            g = null; // scroll vertical natif → on lâche le geste
            return;
          }
        }
      }

      // Vélocité instantanée (px/ms).
      const dt = e.timeStamp - g.lastT || 16;
      g.vx = (t.clientX - g.lastX) / dt;
      g.vy = (t.clientY - g.lastY) / dt;
      g.lastX = t.clientX;
      g.lastY = t.clientY;
      g.lastT = e.timeStamp;

      if (g.axis === 'h') {
        e.preventDefault(); // on prend la main sur l'horizontale
        const move = g.hasNeighbor ? dx : dx * EDGE_RESIST; // butée élastique aux bornes
        g.curMove = move;
        track.style.transition = 'none';
        track.style.transform = `translateX(${move}px)`;
        track.style.willChange = 'transform';
      } else if (g.axis === 'v' && g.pullMode) {
        // Pas de preventDefault : au bord rien à scroller (`overscroll:contain`
        // gèle le rubber-band) → on lit passivement et on translate la surface.
        const move = dy * (0.5 + 0.5 * EDGE_RESIST);
        g.curMove = move;
        surf.style.transform = `translateY(${move}px)`;
        if (pageBg) pageBg.style.opacity = String(Math.max(0.12, 1 - Math.abs(move) / 520));
      }
    };

    const onEnd = () => {
      if (!g) return;
      const gg = g;
      g = null;
      if (gg.axis === 'h') {
        const dist = Math.abs(gg.curMove);
        const flick = Math.abs(gg.vx) > H_COMMIT_VELOCITY && Math.sign(gg.vx) === -gg.dir;
        if (gg.hasNeighbor && (dist > gg.panelW * H_COMMIT_RATIO || flick)) {
          commitCarousel(gg.dir, gg.panelW, gg.curMove);
        } else {
          revertCarousel(gg.curMove);
        }
      } else if (gg.axis === 'v' && gg.pullMode) {
        const dist = Math.abs(gg.curMove);
        const flick =
          Math.abs(gg.vy) > V_CLOSE_VELOCITY &&
          ((gg.pullMode === 'down' && gg.vy > 0) || (gg.pullMode === 'up' && gg.vy < 0));
        if (dist > V_CLOSE_DISTANCE || flick) {
          startClose(gg.curMove);
        } else {
          revertPull(gg.curMove);
        }
      }
    };

    // Non-passif : `preventDefault` fiable sur l'axe horizontal en PWA iOS.
    scroller.addEventListener('touchstart', onStart, { passive: false });
    scroller.addEventListener('touchmove', onMove, { passive: false });
    scroller.addEventListener('touchend', onEnd, { passive: true });
    scroller.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      scroller.removeEventListener('touchstart', onStart);
      scroller.removeEventListener('touchmove', onMove);
      scroller.removeEventListener('touchend', onEnd);
      scroller.removeEventListener('touchcancel', onEnd);
    };
  }, [interactive, reduced, index, items, startClose, computeGeomForSlug]);

  // Bouton « retour » (mobile/PWA) ferme l'overlay via popstate.
  useEffect(() => {
    try {
      window.history.pushState({ ncMorph: true }, '');
    } catch {
      /* noop */
    }
    const onPop = () => {
      poppedRef.current = true;
      startClose();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [startClose]);

  // Clavier : Échap ferme ; ←/→ naviguent ; Tab piégé DANS la surface.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        startClose();
        return;
      }
      if (e.key === 'ArrowRight' && index < items.length - 1) {
        setIndex((i) => Math.min(items.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        setIndex((i) => Math.max(0, i - 1));
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
  }, [startClose, index, items.length]);

  // À l'ouverture : déplace le focus DANS le dialogue (la surface, tabindex -1).
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      surfRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Verrou de scroll NON déplaçant de la GRILLE derrière (overflow figé, sans
  // position:fixed qui sauterait le scroll et tressauterait la BottomNav iOS).
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

  // Fermeture au tap sur le fond (hors surface) — POINTER events (le `click` sur un
  // conteneur scrollable est avalé sur iOS) avec détente anti-drag.
  const pressRef = useRef<{ x: number; y: number; onBackdrop: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const onBackdrop = !surfRef.current?.contains(e.target as Node);
    pressRef.current = { x: e.clientX, y: e.clientY, onBackdrop };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = pressRef.current;
    pressRef.current = null;
    if (!p || !p.onBackdrop) return;
    if (surfRef.current?.contains(e.target as Node)) return;
    const moved = Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
    if (moved < 12) startClose();
  };

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <div
        ref={pageBgRef}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-surface-page)', opacity: 0, pointerEvents: 'none', touchAction: 'none' }}
      />

      {/* Conteneur de SCROLL plein écran. Clic sur la zone vide → fermeture. */}
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
          WebkitOverflowScrolling: interactive ? 'touch' : 'auto',
          // `pan-y` : le navigateur garde le scroll vertical natif, on prend la
          // main sur l'horizontale (carrousel). Le pull vertical au bord est géré
          // sans preventDefault (overscroll:contain gèle le rubber-band).
          touchAction: interactive ? 'pan-y' : 'none',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
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
          {/* PISTE du carrousel — porte la surface (en flux) + le voisin fantôme
              (absolu, positionné PAR RAPPORT à la piste → d'où `relative`).
              CRITIQUE iOS/PWA : `relative` (comme `transform`) fait de la piste un
              bloc conteneur qui PIÈGE le `position: fixed` de la surface pendant le
              morph (la fermeture après scroll rétrécissait hors écran — bug #258).
              → la piste n'est `relative` QUE pendant un drag (ghost monté) ; sinon
              `static` : l'ancêtrage redevient identique à la version validée
              (surface → wrapper statique → colonne statique → scroller fixed).
              Le drag et le morph ne se chevauchent jamais. */}
          <div ref={trackRef} style={{ position: ghost ? 'relative' : 'static', width: SURF_WIDTH, pointerEvents: 'none' }}>
            {/* SURFACE (encadré) — le DIALOGUE a11y. Aucune prop de LAYOUT ici
                (position/width/height/overflow/radius/top/left/transform) : pilotées
                EXCLUSIVEMENT en inline JS. */}
            <div
              ref={surfRef}
              role="dialog"
              aria-modal="true"
              aria-label={item.titre}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              style={{
                ...SURFACE_BOX_STYLE,
                outline: 'none',
                pointerEvents: 'auto',
                willChange: 'width, height, transform, border-radius',
              }}
            >
              <EncContent
                item={item}
                body={body}
                startedEmpty={startedEmpty}
                contentIn={contentIn}
                reduced={reduced}
                visible={interactive}
                encRef={encRef}
                encTitleRef={encTitleRef}
              />

              {/* CROIX — ancrée en haut à droite de la CARTE (défile avec elle). */}
              <button
                type="button"
                onClick={() => startClose()}
                aria-label="Fermer"
                style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '1px solid var(--color-border-default)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 2, opacity: interactive ? 1 : 0, pointerEvents: interactive ? 'auto' : 'none', transition: 'opacity 160ms ease' }}
              >
                ✕
              </button>

              {/* Clone du CONTENU CARTE (départ) — réplique la carte de la grille */}
              <div
                ref={cardRef}
                style={{ position: 'absolute', top: 0, left: 0, width: source.cardRect.width, padding: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, opacity: interactive ? 0 : 1, willChange: 'opacity', pointerEvents: 'none' }}
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

            {/* PANNEAU VOISIN (fantôme) — monté seulement pendant un drag horizontal.
                Rendu identique à la surface au repos (parité pixel au swap). */}
            {ghost && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: ghost.dir > 0 ? `calc(100% + ${PANEL_GAP}px)` : `calc(-100% - ${PANEL_GAP}px)`,
                  width: SURF_WIDTH,
                  pointerEvents: 'none',
                }}
              >
                <div style={SURFACE_BOX_STYLE}>
                  <EncContent
                    item={ghost.item}
                    body={bodyFor(ghost.item)}
                    startedEmpty={false}
                    contentIn
                    reduced
                    visible
                  />
                  <div style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '1px solid var(--color-border-default)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', fontSize: 18, lineHeight: 1, pointerEvents: 'none' }}>
                    ✕
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FLOU HAUT (PWA) : bande floutée en haut. */}
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
