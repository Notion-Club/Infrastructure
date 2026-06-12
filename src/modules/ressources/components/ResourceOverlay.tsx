'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ResourceItem, UserCapability } from '../types';
import { canAccess } from '../lib/access';
import { ResourceBadge } from './shared/ResourceBadge';
import { CapabilityLock } from './shared/CapabilityLock';
import { TellaEmbed } from './shared/TellaEmbed';
import { renderBlock, formatDate } from './shared/renderBlock';

// Mécanique FLIP portée du prototype validé (ressource-container-transform.html).
const OPEN_DUR = 460;
const CLOSE_DUR = 380;
const SMOOTH = 'cubic-bezier(.22,1,.36,1)';
const RADIUS_CARD = 16; // = border-radius des cartes ressource/template
const RADIUS_PANEL = 24;

type Rect = { top: number; left: number; width: number; height: number };

function targetRect(): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = vw < 560 ? 12 : 24;
  const w = Math.min(720, vw - margin * 2);
  return { left: (vw - w) / 2, top: margin, width: w, height: vh - margin * 2 };
}

const GEOM_TRANSITION = (dur: number) =>
  `top ${dur}ms ${SMOOTH}, left ${dur}ms ${SMOOTH}, width ${dur}ms ${SMOOTH},` +
  `height ${dur}ms ${SMOOTH}, border-radius ${dur}ms ${SMOOTH}`;

interface ResourceOverlayProps {
  item: ResourceItem | null;
  /** Élément DOM de la carte cliquée (source du morph, masqué pendant l'overlay). */
  sourceEl: HTMLElement | null;
  currentCapability: UserCapability;
  /** Appelé UNE FOIS l'animation de fermeture terminée (le parent remet l'état à null). */
  onClose: () => void;
}

export function ResourceOverlay({ item, sourceEl, currentCapability, onClose }: ResourceOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const cardRef = useRef<HTMLElement | null>(null);
  const openedForRef = useRef<ResourceItem | null>(null);
  const busyRef = useRef(false);
  const reducedRef = useRef(false);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const [open, setOpen] = useState(false); // pilote la classe .is-open (fondus header/corps)
  const [mounted, setMounted] = useState(false); // portal client-only

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // setState différé (rAF) → évite le « setState synchrone dans un effet ».
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const setGeom = (el: HTMLElement, r: Rect) => {
    el.style.top = `${r.top}px`;
    el.style.left = `${r.left}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
  };

  const close = useCallback(() => {
    const panel = panelRef.current;
    const card = cardRef.current;
    if (!panel || busyRef.current || !openedForRef.current) return;
    busyRef.current = true;
    setOpen(false); // fondus de sortie

    const cleanup = () => {
      panel.style.cssText = '';
      panel.style.display = 'none';
      if (card) card.style.visibility = '';
      document.body.style.overflow = '';
      prevFocusRef.current?.focus?.();
      cardRef.current = null;
      openedForRef.current = null;
      busyRef.current = false;
      onClose();
    };

    if (reducedRef.current || !card) {
      cleanup();
      return;
    }

    const back = card.getBoundingClientRect(); // scroll verrouillé → rect inchangé
    panel.style.transition = GEOM_TRANSITION(CLOSE_DUR);
    setGeom(panel, { top: back.top, left: back.left, width: back.width, height: back.height });
    panel.style.borderRadius = `${RADIUS_CARD}px`;

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'height') return;
      panel.removeEventListener('transitionend', onEnd);
      cleanup();
    };
    panel.addEventListener('transitionend', onEnd);
  }, [onClose]);

  // Ouverture : déclenchée par l'arrivée d'un `item`. useLayoutEffect → la
  // géométrie de départ (rect de la carte) est posée AVANT le paint (pas de flash).
  useLayoutEffect(() => {
    if (!item || !sourceEl) return;
    if (openedForRef.current === item) return;
    const panel = panelRef.current;
    if (!panel) return;

    openedForRef.current = item;
    busyRef.current = true;
    prevFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    // On manipule la carte source uniquement via la ref (escape hatch DOM
    // sanctionné) — jamais en mutant directement la prop `sourceEl`.
    cardRef.current = sourceEl;
    const card = cardRef.current;

    const first = card.getBoundingClientRect();
    document.body.style.overflow = 'hidden';

    // Poser le panneau exactement sur la carte, masquer la carte.
    panel.style.willChange = 'top, left, width, height';
    panel.style.transition = 'none';
    panel.style.borderRadius = `${RADIUS_CARD}px`;
    setGeom(panel, { top: first.top, left: first.left, width: first.width, height: first.height });
    card.style.visibility = 'hidden';
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    const last = targetRect();

    if (reducedRef.current) {
      setGeom(panel, last);
      panel.style.borderRadius = `${RADIUS_PANEL}px`;
      setOpen(true);
      busyRef.current = false;
      closeRef.current?.focus();
      return;
    }

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        panel.style.transition = GEOM_TRANSITION(OPEN_DUR);
        setGeom(panel, last);
        panel.style.borderRadius = `${RADIUS_PANEL}px`;
        setOpen(true); // déclenche le fondu décalé header/corps
        const onEnd = (e: TransitionEvent) => {
          if (e.propertyName !== 'height') return;
          panel.removeEventListener('transitionend', onEnd);
          busyRef.current = false;
          closeRef.current?.focus();
        };
        panel.addEventListener('transitionend', onEnd);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [item, sourceEl]);

  // Échap + re-ciblage au resize (tant qu'un item est ouvert).
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onResize = () => {
      const panel = panelRef.current;
      if (panel && cardRef.current && !busyRef.current) {
        panel.style.transition = 'none';
        setGeom(panel, targetRect());
      }
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [item, close]);

  const it = item;
  const locked = it ? !canAccess(currentCapability, it.visibilite) : false;

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`nc-rovl-scrim${open ? ' is-open' : ''}`}
        onClick={close}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={`nc-rovl-panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={it?.titre ?? undefined}
        // React ne gère QUE `display` (depuis la présence de l'item) ; toute la
        // géométrie + border-radius sont posés impérativement (sinon un re-render
        // réinitialiserait le morph en cours).
        style={{ display: it ? 'block' : 'none' }}
      >
        {it && (
          <>
            <button
              ref={closeRef}
              type="button"
              className="nc-rovl-close"
              aria-label="Fermer"
              onClick={close}
            >
              <X size={16} />
            </button>
            <div ref={scrollRef} className="nc-rovl-scroll">
              {/* Header — instantané depuis l'item de la grille (zéro fetch). */}
              <div className="nc-rovl-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <ResourceBadge
                    variant={it.category === 'resource' ? 'ressource' : 'template'}
                    label={it.category === 'resource' ? 'Ressource' : 'Template'}
                  />
                  {it.category === 'resource'
                    ? it.formation.map((f) => <ResourceBadge key={f} variant="formation" label={f} />)
                    : <ResourceBadge variant="type" label={it.type} />}
                  {it.category === 'resource' &&
                    it.type.map((t) => <ResourceBadge key={t} variant="type" label={t} />)}
                </div>
                <h2
                  style={{
                    fontSize: 'clamp(22px, 3.4vw, 30px)',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.12,
                    margin: '12px 0 0',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {it.titre}
                </h2>
                <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', margin: '12px 0 0', lineHeight: 1.6 }}>
                  {it.description}
                </p>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {formatDate(it.dateCreation)}
                </div>
              </div>

              {/* Corps — révélé APRÈS le morph (.nc-rovl-body), donc les CTA aussi. */}
              <div
                className="nc-rovl-body"
                style={{ marginTop: 22, borderTop: '1px solid var(--color-border-default)', paddingTop: 22 }}
              >
                {locked ? (
                  <CapabilityLock
                    title={`Contenu réservé aux membres ${it.visibilite}`}
                    description={`Ce contenu est accessible à partir de l'offre ${it.visibilite}. Rejoins le programme pour le débloquer ainsi que toute la bibliothèque correspondante.`}
                    ctaLabel="Découvrir les offres"
                    ctaHref="/offres"
                  />
                ) : it.category === 'resource' ? (
                  <>{it.content.map((b, i) => renderBlock(b, i))}</>
                ) : (
                  <>
                    {it.urlTella && <TellaEmbed url={it.urlTella} />}
                    <div style={{ marginTop: it.urlTella ? 24 : 0 }}>
                      <a
                        href={it.urlNotionPublicPage}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '12px 24px',
                          borderRadius: 9999,
                          background: 'var(--nc-btn-dark-bg)',
                          color: 'var(--nc-btn-dark-text)',
                          fontSize: 15,
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        Dupliquer dans Notion
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
