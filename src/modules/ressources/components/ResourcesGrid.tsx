'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { ResourceItem, ResourceMetierType, UserCapability } from '../types';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceCard } from './ResourceCard';
import { TemplateCard } from './TemplateCard';
import { SuggestTemplateCard } from './SuggestTemplateCard';
import { NoResultsState } from './NoResultsState';
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
  // Raccourci clavier affiché : ⌘ sur Mac, sinon « Ctrl ». Défaut Mac pour que
  // le 1er rendu client corresponde au SSR (pas de hydration mismatch) ; corrigé
  // au montage selon la plateforme réelle.
  const [isMac, setIsMac] = useState(true);
  // Aligne le dropdown à droite quand l'ancrage gauche le ferait déborder
  // hors du viewport (cas mobile : bouton trop à droite de l'écran).
  const [alignRight, setAlignRight] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    // Détection client-only après montage (volontaire) : éviter de lire navigator
    // au rendu casserait l'hydratation. C'est l'exception légitime à la règle.
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/mac/i.test(platform));
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Focus direct : déclenché par un vrai événement clavier (activation
        // utilisateur valide). `onFocus` de l'input bascule `searchActive`.
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

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

  // Recherche texte → reflow FLIP de la grille.
  function onSearch(value: string) {
    setSearchQuery(value);
    animateTo(buildVisibleIds(value, primaryFilter, selectedTypes), { mode: 'reflow' });
  }

  // Fermeture : vide le champ et retire le focus → `onBlur` repasse en inactif.
  function clearAndCloseSearch() {
    onSearch('');
    setSearchActive(false);
    searchInputRef.current?.blur();
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
        {/* Tags group (droite) — bouton Filtres à gauche, pills à droite.
            marginLeft:auto le pousse à droite sans coupler la largeur de la
            recherche (qui reste fixe). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
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

        {/* Search — LEFT (order:-1), largeur FIXE et verrouillée : barre longue
            (élément central) qui NE se redimensionne PAS quand le bouton Filtres
            disparaît (flexShrink:0, aucune relation flex avec les filtres). */}
        {/* Two layers always in DOM; opacity-toggled so text-swap animation
            completes before the button layer fades out and input fades in. */}
        <div
          className="nc-search-shimmer"
          style={{ order: -1, width: 600, maxWidth: '100%', flexShrink: 0, position: 'relative', height: 44 }}
        >
          {/* BASE — input réel, TOUJOURS monté/visible/interactif. Le tap atterrit
              directement dessus → focus natif → clavier mobile, sans focus différé.
              searchActive n'est plus qu'une conséquence cosmétique du focus. */}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setSearchActive(true)}
            onBlur={() => { if (!searchQuery) setSearchActive(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape') searchInputRef.current?.blur(); }}
            aria-label="Cherche une ressource"
            data-fb-label="Champ recherche · Grille des ressources"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: 44,
              padding: '0 40px 0 44px',
              borderRadius: 9999,
              border: '1px solid',
              borderColor: searchActive ? 'transparent' : 'var(--color-border-default)',
              background: 'var(--color-surface-card)',
              fontSize: 14,
              color: 'var(--color-text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 200ms ease',
              zIndex: 1,
            }}
          />

          {/* ── Habillage décoratif (pointer-events:none) : n'intercepte JAMAIS le
              geste, le tap traverse jusqu'à l'input. ───────────────────────────── */}

          {/* Anneau breathe mono — état inactif */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              opacity: searchActive ? 0 : 1,
              pointerEvents: 'none',
              transition: 'opacity 200ms ease',
              zIndex: 2,
            }}
          >
            <BorderBeam
              size="pulse-inner"
              colorVariant="mono"
              strength={0.74}
              theme={theme}
              style={{ width: '100%', height: 44, borderRadius: 9999 }}
            >
              <div style={{ width: '100%', height: 44, borderRadius: 9999 }} />
            </BorderBeam>
          </div>

          {/* Anneau rouge signature — état actif */}
          <div
            aria-hidden
            className="nc-search-beam"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 9999,
              opacity: searchActive ? 1 : 0,
              pointerEvents: 'none',
              transition: 'opacity 200ms ease',
              zIndex: 2,
            }}
          />

          {/* Icône loupe persistante (alignée sur le texte de l'input) */}
          <Search
            size={15}
            aria-hidden
            style={{
              position: 'absolute',
              left: 18,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />

          {/* Libellé inactif + raccourci ⌘/Ctrl K — fondu via searchActive */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 18px 0 44px',
              pointerEvents: 'none',
              opacity: searchActive ? 0 : 1,
              transition: 'opacity 200ms ease',
              zIndex: 3,
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Cherche une ressource…
            </span>
            <span className="nc-kbd-hint" style={{ alignItems: 'center', gap: 3, flexShrink: 0, opacity: 0.5 }}>
              <kbd className="nc-kbd-badge">{isMac ? '\u2318' : 'Ctrl'}</kbd>
              <kbd className="nc-kbd-badge">K</kbd>
            </span>
          </div>

          {/* Placeholder shimmer actif « Que cherches-tu ? » — fondu, non interactif */}
          <span
            aria-hidden
            className={searchActive ? 't-shimmer' : undefined}
            data-text="Que cherches-tu ?"
            style={{
              position: 'absolute',
              left: 44,
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
            Que cherches-tu ?
          </span>

          {/* Bouton fermer — seul habillage interactif, visible quand actif */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearAndCloseSearch}
            aria-label="Fermer la recherche"
            tabIndex={searchActive ? 0 : -1}
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
              opacity: searchActive ? 1 : 0,
              pointerEvents: searchActive ? 'auto' : 'none',
              transition: 'opacity 150ms ease',
              zIndex: 4,
            }}
          >
            <X size={10} />
          </button>
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
          <NoResultsState
            filloutType={primaryFilter === 'Templates' ? 'Template Notion' : 'Ressource'}
          />
        ))}
    </div>
  );
}
