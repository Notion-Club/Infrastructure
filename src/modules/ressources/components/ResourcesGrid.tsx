'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { BorderBeam } from 'border-beam';
import type { ResourceItem, ResourceMetierType, UserCapability } from '../types';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceCard } from './ResourceCard';
import { TemplateCard } from './TemplateCard';
import { SuggestTemplateCard } from './SuggestTemplateCard';

type PrimaryFilter = 'Tout' | 'Ressources' | 'Templates';

const PRIMARY_FILTERS: PrimaryFilter[] = ['Tout', 'Ressources', 'Templates'];

const METIER_TYPES: ResourceMetierType[] = [
  'Relation Client',
  'Production',
  'Acquisition',
  'Sales',
  'Business',
  'Rediffusion de Live',
];

interface ResourcesGridProps {
  items: ResourceItem[];
}

function extractSearchText(item: ResourceItem): string {
  const base = `${item.titre} ${item.description}`;
  if (item.category !== 'resource') return base.toLowerCase();
  const contentText = item.content
    .map((block) => {
      if (block.type === 'paragraph' || block.type === 'heading') return block.text;
      if (block.type === 'list') return block.items.join(' ');
      return '';
    })
    .join(' ');
  return `${base} ${contentText}`.toLowerCase();
}

export function ResourcesGrid({ items }: ResourcesGridProps) {
  const searchParams = useSearchParams();
  const catParam = searchParams.get('cat');
  const typeParam = searchParams.get('type');

  const [primaryFilter, setPrimaryFilter] = useState<PrimaryFilter>(() => {
    if (catParam === 'template') return 'Templates';
    if (catParam === 'resource') return 'Ressources';
    return 'Tout';
  });
  const [selectedTypes, setSelectedTypes] = useState<Set<ResourceMetierType>>(() => {
    if (typeParam && (METIER_TYPES as readonly string[]).includes(typeParam)) {
      return new Set([typeParam as ResourceMetierType]);
    }
    return new Set();
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [leavingItems, setLeavingItems] = useState<ResourceItem[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeAccordionOpen, setTypeAccordionOpen] = useState(true);
  // Aligne le dropdown à droite quand l'ancrage gauche le ferait déborder
  // hors du viewport (cas mobile : bouton trop à droite de l'écran).
  const [alignRight, setAlignRight] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const prevVisibleRef = useRef<ResourceItem[]>([]);
  const leavingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctaTextRef = useRef<HTMLSpanElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const kbdsRef = useRef<HTMLSpanElement>(null);

  const currentCapability: UserCapability = mockCurrentUser.capability;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!searchActive) activateSearch();
        else searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchActive]);

  useEffect(() => {
    if (!filterOpen) return;
    const DROPDOWN_WIDTH = 240;
    const rect = filterBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setAlignRight(rect.left + DROPDOWN_WIDTH > window.innerWidth - 12);
    }
    function onClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [filterOpen]);

  const filteredItems = items.filter((item) => {
    if (primaryFilter === 'Ressources' && item.category !== 'resource') return false;
    if (primaryFilter === 'Templates' && item.category !== 'template') return false;
    if (selectedTypes.size > 0 && item.category === 'resource') {
      const hasMatchingType = item.type.some((t) => selectedTypes.has(t));
      if (!hasMatchingType) return false;
    }
    return true;
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleItems = normalizedQuery
    ? filteredItems.filter((item) => extractSearchText(item).includes(normalizedQuery))
    : filteredItems;

  const hasActiveFilters = selectedTypes.size > 0;

  // Track items leaving the grid to animate them out
  useEffect(() => {
    const prev = prevVisibleRef.current;
    const currentSlugs = new Set(visibleItems.map((i) => i.slug));
    const removed = prev.filter((item) => !currentSlugs.has(item.slug));
    prevVisibleRef.current = visibleItems;

    if (removed.length === 0) return;

    setLeavingItems(removed);
    if (leavingTimerRef.current) clearTimeout(leavingTimerRef.current);
    leavingTimerRef.current = setTimeout(() => setLeavingItems([]), 220);
  }, [visibleItems]);

  function activateSearch() {
    const el = ctaTextRef.current;
    const kbds = kbdsRef.current;
    const dur = 150;

    if (el) {
      // Immediately fade kbds out in sync with the CTA text exit
      if (kbds) {
        kbds.style.transition = 'opacity 120ms ease';
        kbds.style.opacity = '0';
      }

      // Phase 1 — exit old CTA text (slides up + blurs)
      el.classList.add('is-exit');

      setTimeout(() => {
        // Phase 2 — swap to shimmer text, teleport below, no transition
        el.textContent = 'Que cherches-tu ?';
        el.setAttribute('data-text', 'Que cherches-tu ?');
        el.classList.add('t-shimmer');
        el.classList.remove('is-exit');
        el.classList.add('is-enter-start');
        void el.offsetHeight;
        el.classList.remove('is-enter-start');

        // Phase 3 — after enter animation completes, reveal input layer
        setTimeout(() => {
          setSearchActive(true);
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }, dur + 60);
      }, dur);
    } else {
      setSearchActive(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }

  function deactivateSearch() {
    const el = ctaTextRef.current;
    const kbds = kbdsRef.current;
    const dur = 150;

    setSearchQuery('');

    if (el) {
      // Reverse text swap on button layer (still invisible at this point).
      // Phase 1 — exit shimmer text
      el.classList.add('is-exit');

      setTimeout(() => {
        // Phase 2 — enter original CTA text from below
        el.textContent = '🔍 Cherche une ressource…';
        el.removeAttribute('data-text');
        el.classList.remove('t-shimmer', 'is-exit');
        el.classList.add('is-enter-start');
        void el.offsetHeight;
        el.classList.remove('is-enter-start');

        // Phase 3 — now fade in the button layer with CTA entering
        setSearchActive(false);

        // Restore kbds after CTA text has fully entered
        setTimeout(() => {
          if (kbds) {
            kbds.style.transition = 'opacity 150ms ease';
            kbds.style.opacity = '0.5';
          }
        }, dur);
      }, dur);
    } else {
      setSearchActive(false);
    }
  }

  function toggleType(type: ResourceMetierType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function resetFilters() {
    setSelectedTypes(new Set());
    setSearchQuery('');
  }

  const showTypeFilter = primaryFilter === 'Tout' || primaryFilter === 'Ressources';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter bar + search on same row */}
      <div
        data-fb-label="Filtre barre · Grille des ressources"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* Primary filter pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {PRIMARY_FILTERS.map((filter) => {
            const isActive = primaryFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                data-fb-label={`Filtre « ${filter} » · Grille des ressources`}
                onClick={() => {
                  setPrimaryFilter(filter);
                  if (filter === 'Templates') {
                    setSelectedTypes(new Set());
                    setFilterOpen(false);
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : 'var(--color-text-primary)',
                  background: isActive ? 'var(--color-brand)' : 'var(--color-surface-raised)',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--color-brand)' : 'var(--color-border-default)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  whiteSpace: 'nowrap',
                }}
                className={!isActive ? 'hover:bg-[#eaeaea]' : 'hover:opacity-90'}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Type filter button */}
        {showTypeFilter && (
          <div ref={filterRef} style={{ position: 'relative' }}>
            <button
              ref={filterBtnRef}
              type="button"
              data-fb-label="Bouton Filtres · Grille des ressources"
              onClick={() => setFilterOpen((o) => !o)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 500,
                color: hasActiveFilters ? '#ffffff' : 'var(--color-text-primary)',
                background: hasActiveFilters ? 'var(--color-brand)' : 'var(--color-surface-raised)',
                border: '1px solid',
                borderColor: hasActiveFilters ? 'var(--color-brand)' : 'var(--color-border-default)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                whiteSpace: 'nowrap',
              }}
              className={!hasActiveFilters ? 'hover:bg-[#eaeaea]' : 'hover:opacity-90'}
            >
              <SlidersHorizontal size={13} />
              Filtres
              {hasActiveFilters && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: 'var(--color-surface-card)',
                    color: 'var(--color-brand)',
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {selectedTypes.size}
                </span>
              )}
            </button>

            {filterOpen && (
              <div
                data-fb-label="Modale filtres · Grille des ressources"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: alignRight ? 'auto' : 0,
                  right: alignRight ? 0 : 'auto',
                  minWidth: 220,
                  maxWidth: 'calc(100vw - 24px)',
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 16,
                  boxShadow: 'var(--nc-shadow-2)',
                  zIndex: 20,
                  overflow: 'hidden',
                }}
              >
                {/* Accordion header */}
                <button
                  type="button"
                  onClick={() => setTypeAccordionOpen((o) => !o)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    borderBottom: typeAccordionOpen ? '1px solid var(--color-border-default)' : 'none',
                  }}
                >
                  Type métier
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-muted)',
                      transform: typeAccordionOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms ease',
                      display: 'inline-block',
                    }}
                  >
                    ▾
                  </span>
                </button>

                {typeAccordionOpen && (
                  <div style={{ padding: '8px 0' }}>
                    {METIER_TYPES.map((type) => {
                      const checked = selectedTypes.has(type);
                      return (
                        <label
                          key={type}
                          data-fb-label={`Filtre « ${type} » · Grille des ressources`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 14px',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: 'var(--color-text-primary)',
                          }}
                          className="hover:bg-[var(--color-surface-raised)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleType(type)}
                            style={{ accentColor: 'var(--color-brand)', width: 14, height: 14 }}
                          />
                          {type}
                        </label>
                      );
                    })}
                  </div>
                )}

                {hasActiveFilters && (
                  <div
                    style={{
                      borderTop: '1px solid var(--color-border-default)',
                      padding: '8px 14px',
                    }}
                  >
                    <button
                      type="button"
                      data-fb-label="Bouton Réinitialiser filtres · Grille des ressources"
                      onClick={() => {
                        resetFilters();
                        setFilterOpen(false);
                      }}
                      style={{
                        width: '100%',
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--color-brand)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px 0',
                        textAlign: 'left',
                      }}
                    >
                      Réinitialiser
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search — right-aligned, fixed width, same row as filters */}
        {/* Two layers always in DOM; opacity-toggled so text-swap animation
            completes before the button layer fades out and input fades in. */}
        <div style={{ marginLeft: 'auto', position: 'relative', width: 240, flexShrink: 0, height: 36 }}>

          {/* Layer A — idle CTA button with BorderBeam */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: searchActive ? 0 : 1,
              pointerEvents: searchActive ? 'none' : 'auto',
              transition: 'opacity 150ms ease',
              zIndex: searchActive ? 0 : 1,
            }}
          >
            <BorderBeam size="pulse-inner" colorVariant="mono" strength={0.48} theme="light">
              <button
                type="button"
                data-fb-label="Bouton recherche · Grille des ressources"
                onClick={activateSearch}
                style={{
                  width: '100%',
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  padding: '0 12px',
                  borderRadius: 9999,
                  border: '1px solid var(--color-border-default)',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  ref={ctaTextRef}
                  className="t-text-swap"
                  style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  🔍 Cherche une ressource…
                </span>
                <span ref={kbdsRef} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, opacity: 0.5 }}>
                  <kbd style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'inherit', padding: '1px 4px', borderRadius: 4, border: '1px solid #d1d5db', background: '#f3f4f6', color: '#6b7280', lineHeight: 1.4 }}>⌘</kbd>
                  <kbd style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'inherit', padding: '1px 4px', borderRadius: 4, border: '1px solid #d1d5db', background: '#f3f4f6', color: '#6b7280', lineHeight: 1.4 }}>K</kbd>
                </span>
              </button>
            </BorderBeam>
          </div>

          {/* Layer B — active input with shimmer placeholder */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: searchActive ? 1 : 0,
              pointerEvents: searchActive ? 'auto' : 'none',
              transition: 'opacity 150ms ease',
              zIndex: searchActive ? 1 : 0,
            }}
          >
            {/* Shimmer placeholder — always in DOM, opacity-driven for smooth entrance */}
            <span
              className={searchActive ? 't-shimmer' : ''}
              data-text={searchActive ? 'Que cherches-tu ?' : ''}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 13,
                pointerEvents: 'none',
                zIndex: 2,
                whiteSpace: 'nowrap',
                opacity: searchActive && !searchQuery ? 1 : 0,
                transition: 'opacity 180ms ease 60ms',
              }}
            >
              {searchActive ? 'Que cherches-tu ?' : ''}
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                padding: '0 32px 0 14px',
                borderRadius: 9999,
                border: '1px solid var(--color-brand)',
                background: searchQuery ? '#ffffff' : 'transparent',
                boxShadow: '0 0 0 3px rgba(224,98,90,0.12)',
                fontSize: 13,
                color: 'var(--color-text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onBlur={() => { if (!searchQuery) deactivateSearch(); }}
              onKeyDown={(e) => { if (e.key === 'Escape') deactivateSearch(); }}
            />
            <button
              type="button"
              onClick={deactivateSearch}
              aria-label="Fermer la recherche"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                padding: 0,
                zIndex: 3,
              }}
            >
              <X size={10} />
            </button>
          </div>

        </div>
      </div>

      {/* Grid */}
      {filteredItems.length > 0 ? (
        <>
          {visibleItems.length > 0 ? (
            <div data-fb-label="Grille des ressources" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleItems.map((item, idx) => (
                <div
                  key={item.slug}
                  style={{
                    height: '100%',
                    animation: 'nc-card-stagger-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both',
                    animationDelay: `${Math.min(idx * 35, 180)}ms`,
                  }}
                >
                  {item.category === 'resource' ? (
                    <ResourceCard resource={item} currentCapability={currentCapability} />
                  ) : (
                    <TemplateCard template={item} currentCapability={currentCapability} />
                  )}
                </div>
              ))}
              {/* Items fading out — appended at end so the grid reflows above */}
              {leavingItems.map((item) => (
                <div
                  key={`out-${item.slug}`}
                  style={{
                    height: '100%',
                    opacity: 0,
                    transform: 'translateY(0)',
                    filter: 'blur(0)',
                    transition: 'opacity 180ms ease',
                    pointerEvents: 'none',
                  }}
                >
                  {item.category === 'resource' ? (
                    <ResourceCard resource={item} currentCapability={currentCapability} />
                  ) : (
                    <TemplateCard template={item} currentCapability={currentCapability} />
                  )}
                </div>
              ))}
              <SuggestTemplateCard variant={primaryFilter} />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                gap: 10,
                color: 'var(--color-text-muted)',
              }}
            >
              <p style={{ fontSize: 14, margin: 0 }}>
                Aucun résultat pour &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--color-brand)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Effacer la recherche
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            gap: 12,
            color: 'var(--color-text-muted)',
          }}
        >
          <p style={{ fontSize: 14, margin: 0 }}>Aucun élément ne correspond à ces filtres.</p>
          <button
            type="button"
            data-fb-label="Bouton Réinitialiser filtres · Grille des ressources"
            onClick={resetFilters}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-brand)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </div>
  );
}
