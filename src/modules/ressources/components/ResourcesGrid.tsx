'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { ResourceItem, ResourceMetierType, UserCapability } from '../types';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceCard } from './ResourceCard';
import { TemplateCard } from './TemplateCard';
import { SuggestTemplateCard } from './SuggestTemplateCard';
import { BorderBeam } from 'border-beam';
import { useTheme } from '@/shared/lib/hooks/useTheme';
import { useGridChoreography } from '@/shared/hooks/useGridChoreography';

/** Id de la carte « Suggérer » — toujours montée, masquée seulement si la grille est vide. */
const SUGGEST_ID = '__suggest__';

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

/** Filtre catégorie + type métier (hors recherche texte). Logique pure, partagée
 *  par le rendu déclaratif (compteurs / états vides) et le calcul de l'ensemble
 *  visible passé à la chorégraphie. */
function matchesFilters(
  item: ResourceItem,
  primary: PrimaryFilter,
  types: Set<ResourceMetierType>,
): boolean {
  if (primary === 'Ressources' && item.category !== 'resource') return false;
  if (primary === 'Templates' && item.category !== 'template') return false;
  if (types.size > 0 && item.category === 'resource') {
    if (!item.type.some((t) => types.has(t))) return false;
  }
  return true;
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeAccordionOpen, setTypeAccordionOpen] = useState(true);
  // Aligne le dropdown à droite quand l'ancrage gauche le ferait déborder
  // hors du viewport (cas mobile : bouton trop à droite de l'écran).
  const [alignRight, setAlignRight] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ctaTextRef = useRef<HTMLSpanElement>(null);
  // Markup d'origine du libellé CTA (icône + texte). Capturé avant la 1re
  // mutation impérative, restauré à la fermeture : React ne re-rend pas ce
  // span statique, donc c'est à nous de remettre le contenu d'origine.
  const ctaHtmlRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const kbdsRef = useRef<HTMLSpanElement>(null);

  const { animateTo, reveal } = useGridChoreography(gridRef);

  const currentCapability: UserCapability = mockCurrentUser.capability;
  const { theme } = useTheme();

  /** Ensemble des slugs visibles pour un état (recherche + filtres) donné.
   *  Inclut la carte « Suggérer » tant qu'au moins une carte réelle est visible. */
  const buildVisibleIds = useCallback(
    (query: string, primary: PrimaryFilter, types: Set<ResourceMetierType>): Set<string> => {
      const needle = query.trim().toLowerCase();
      const ids = new Set<string>();
      for (const item of items) {
        if (!matchesFilters(item, primary, types)) continue;
        if (needle && !extractSearchText(item).includes(needle)) continue;
        ids.add(item.slug);
      }
      if (ids.size > 0) ids.add(SUGGEST_ID);
      return ids;
    },
    [items],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!searchActive) activateSearch();
        else searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
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

  const filteredItems = items.filter((item) => matchesFilters(item, primaryFilter, selectedTypes));

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleItems = normalizedQuery
    ? filteredItems.filter((item) => extractSearchText(item).includes(normalizedQuery))
    : filteredItems;

  const hasActiveFilters = selectedTypes.size > 0;

  // Apparition initiale : applique la visibilité de départ (filtres d'URL) avant
  // le premier paint pour éviter tout flash, puis joue la cascade `reveal()`.
  // La classe `.is-hidden` est ensuite gérée exclusivement par le hook — jamais
  // via le rendu React — pour ne pas écraser ses mutations DOM impératives.
  // Le garde `didReveal` borne l'effet au montage tout en gardant des deps
  // exhaustives (l'état initial reflète déjà les paramètres d'URL).
  const didReveal = useRef(false);
  useLayoutEffect(() => {
    if (didReveal.current) return;
    const container = gridRef.current;
    if (!container) return;
    didReveal.current = true;
    const ids = buildVisibleIds(searchQuery, primaryFilter, selectedTypes);
    container.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
      el.classList.toggle('is-hidden', !ids.has(el.dataset.cardId ?? ''));
    });
    reveal();
  }, [buildVisibleIds, searchQuery, primaryFilter, selectedTypes, reveal]);

  function activateSearch() {
    const el = ctaTextRef.current;
    const kbds = kbdsRef.current;
    const dur = 150;

    if (kbds) {
      kbds.style.transition = 'opacity 120ms ease';
      kbds.style.opacity = '0';
    }

    if (el) {
      // Phase 1 — exit CTA text (blur + slide up)
      el.classList.add('is-exit');

      setTimeout(() => {
        // Phase 2 — swap to shimmer text, teleport below, animate in
        // Mémorise le markup d'origine (icône + libellé) avant de l'écraser.
        if (ctaHtmlRef.current === null) ctaHtmlRef.current = el.innerHTML;
        el.textContent = 'Que cherches-tu ?';
        el.setAttribute('data-text', 'Que cherches-tu ?');
        el.classList.add('t-shimmer');
        el.classList.remove('is-exit');
        el.classList.add('is-enter-start');
        void el.offsetHeight;
        el.classList.remove('is-enter-start');

        // Phase 3 — wait for full enter animation (dur ms) before crossfade
        // This prevents the shimmer mid-animation overlap that caused flickering
        setTimeout(() => {
          setSearchActive(true);
          setTimeout(() => searchInputRef.current?.focus(), dur);
        }, dur);
      }, dur);
    } else {
      setSearchActive(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }

  // Recherche texte → reflow FLIP de la grille.
  function onSearch(value: string) {
    setSearchQuery(value);
    animateTo(buildVisibleIds(value, primaryFilter, selectedTypes), { mode: 'reflow' });
  }

  function deactivateSearch() {
    const el = ctaTextRef.current;
    const kbds = kbdsRef.current;
    const dur = 150;

    setSearchQuery('');
    animateTo(buildVisibleIds('', primaryFilter, selectedTypes), { mode: 'reflow' });

    if (el) {
      // Phase 1 — exit shimmer text (Layer A is invisible, opacity 0)
      el.classList.add('is-exit');

      setTimeout(() => {
        // Remove shimmer + restore the original markup (Search icon + label).
        // React ne re-rend pas ce span statique → on remet le contenu nous-mêmes.
        el.classList.remove('t-shimmer', 'is-exit');
        el.removeAttribute('data-text');
        if (ctaHtmlRef.current !== null) el.innerHTML = ctaHtmlRef.current;
        flushSync(() => setSearchActive(false));

        // Phase 2 — CTA enters from below as Layer A fades in
        el.classList.add('is-enter-start');
        void el.offsetHeight;
        el.classList.remove('is-enter-start');

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
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setSelectedTypes(next);
    animateTo(buildVisibleIds(searchQuery, primaryFilter, next), { mode: 'reflow' });
  }

  function resetFilters() {
    const next = new Set<ResourceMetierType>();
    setSelectedTypes(next);
    setSearchQuery('');
    animateTo(buildVisibleIds('', primaryFilter, next), { mode: 'reflow' });
  }

  // Clic sur un onglet primaire (Tout / Ressources / Templates) → transition
  // directionnelle « panneau ». Le sens dépend de la position de l'onglet cible
  // dans la barre par rapport à l'onglet courant.
  function onPrimaryFilter(filter: PrimaryFilter) {
    const dir = (Math.sign(PRIMARY_FILTERS.indexOf(filter) - PRIMARY_FILTERS.indexOf(primaryFilter)) ||
      1) as 1 | -1;
    const nextTypes = filter === 'Templates' ? new Set<ResourceMetierType>() : selectedTypes;
    setPrimaryFilter(filter);
    if (filter === 'Templates') {
      setSelectedTypes(new Set());
      setFilterOpen(false);
    }
    animateTo(buildVisibleIds(searchQuery, filter, nextTypes), { mode: 'tab', direction: dir });
  }

  const showTypeFilter = primaryFilter === 'Tout' || primaryFilter === 'Ressources';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter bar + search on same row.
          La recherche (order:-1) passe à gauche et grandit ; les tags sont
          regroupés à droite avec un net espacement (gap conteneur). Dans le
          groupe, le bouton Filtres est placé à gauche des pills. */}
      <div
        data-fb-label="Filtre barre · Grille des ressources"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        {/* Tags group (droite) — bouton Filtres à gauche, pills à droite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Primary filter pills */}
        <div style={{ order: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {PRIMARY_FILTERS.map((filter) => {
            const isActive = primaryFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                data-fb-label={`Filtre « ${filter} » · Grille des ressources`}
                onClick={() => onPrimaryFilter(filter)}
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
        </div>
        {/* /Tags group */}

        {/* Search — LEFT (order:-1), grows to be the central long element */}
        {/* Two layers always in DOM; opacity-toggled so text-swap animation
            completes before the button layer fades out and input fades in. */}
        <div style={{ order: -1, flex: '1 1 280px', minWidth: 240, position: 'relative', height: 44 }}>

          {/* Layer A — idle CTA button (breathe mono via BorderBeam, zéro rouge) */}
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
            <BorderBeam
              size="pulse-inner"
              colorVariant="mono"
              strength={0.74}
              theme={theme}
              style={{ width: '100%', height: 44, borderRadius: 9999 }}
            >
            <button
              type="button"
              data-fb-label="Bouton recherche · Grille des ressources"
              onClick={activateSearch}
              style={{
                width: '100%',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                padding: '0 14px',
                borderRadius: 9999,
                border: '1px solid var(--color-border-default)',
                background: 'var(--color-surface-card)',
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--color-text-muted)',
                boxSizing: 'border-box',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                ref={ctaTextRef}
                className="t-text-swap"
                style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden', minWidth: 0 }}
              >
                <Search size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Cherche une ressource…
                </span>
              </span>
              <span ref={kbdsRef} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, opacity: 0.5 }}>
                <kbd className="nc-kbd-badge">⌘</kbd>
                <kbd className="nc-kbd-badge">K</kbd>
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
            {/* Anneau rouge signature recréé en CSS (cf. .nc-search-beam) —
                couleur maîtrisée, contrairement aux palettes figées de BorderBeam. */}
            <div className="nc-search-beam" style={{ position: 'relative', width: '100%', height: 44, borderRadius: 9999 }}>
              {/* Shimmer placeholder — always in DOM, opacity-driven for smooth entrance */}
              <span
                className={searchActive ? 't-shimmer' : ''}
                data-text={searchActive ? 'Que cherches-tu ?' : ''}
                style={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 14,
                  pointerEvents: 'none',
                  zIndex: 3,
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
                onChange={(e) => onSearch(e.target.value)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  padding: '0 34px 0 16px',
                  borderRadius: 9999,
                  border: '1px solid transparent',
                  background: 'var(--color-surface-card)',
                  fontSize: 14,
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  zIndex: 1,
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
                right: 10,
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
                zIndex: 4,
              }}
            >
              <X size={10} />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Grille — toutes les cartes sont montées en permanence (prérequis FLIP).
          Le hook useGridChoreography gère leur visibilité (.is-hidden) et anime
          reflow / changement d'onglet ; React ne pilote jamais la visibilité. */}
      <div
        ref={gridRef}
        data-fb-label="Grille des ressources"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        style={{ position: 'relative' }}
      >
        {items.map((item) => (
          <div key={item.slug} className="nc-grid-card" data-card-id={item.slug} data-cat={item.category}>
            {item.category === 'resource' ? (
              <ResourceCard resource={item} currentCapability={currentCapability} />
            ) : (
              <TemplateCard template={item} currentCapability={currentCapability} />
            )}
          </div>
        ))}
        <div className="nc-grid-card" data-card-id={SUGGEST_ID}>
          <SuggestTemplateCard variant={primaryFilter} />
        </div>
      </div>

      {/* États vides — la grille reste montée (refs/animation), seul ce bloc
          informatif s'affiche par-dessus quand plus aucune carte n'est visible. */}
      {visibleItems.length === 0 &&
        (filteredItems.length === 0 ? (
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
              onClick={() => onSearch('')}
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
        ))}
    </div>
  );
}
