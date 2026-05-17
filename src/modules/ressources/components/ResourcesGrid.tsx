'use client';

import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { ResourceItem, ResourceMetierType, UserCapability } from '../types';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceCard } from './ResourceCard';
import { TemplateCard } from './TemplateCard';

type PrimaryFilter = 'Tout' | 'Ressources' | 'Templates';

const PRIMARY_FILTERS: PrimaryFilter[] = ['Tout', 'Ressources', 'Templates'];

const METIER_TYPES: ResourceMetierType[] = [
  'Relation Client',
  'Production',
  'Acquisition',
  'Sales',
  'Business',
];

interface ResourcesGridProps {
  items: ResourceItem[];
}

function pluralizeCount(count: number, primaryFilter: PrimaryFilter): string {
  if (primaryFilter === 'Ressources') {
    return count <= 1 ? `${count} ressource` : `${count} ressources`;
  }
  if (primaryFilter === 'Templates') {
    return count <= 1 ? `${count} template` : `${count} templates`;
  }
  // Tout — mix
  if (count <= 1) return `${count} élément`;
  return `${count} éléments`;
}

export function ResourcesGrid({ items }: ResourcesGridProps) {
  const [primaryFilter, setPrimaryFilter] = useState<PrimaryFilter>('Tout');
  const [selectedTypes, setSelectedTypes] = useState<Set<ResourceMetierType>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeAccordionOpen, setTypeAccordionOpen] = useState(true);
  const filterRef = useRef<HTMLDivElement>(null);

  const currentCapability: UserCapability = mockCurrentUser.capability;

  useEffect(() => {
    if (!filterOpen) return;
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
      if (!selectedTypes.has(item.type)) return false;
    }
    return true;
  });

  const hasActiveFilters = selectedTypes.size > 0;

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
  }

  const showTypeFilter = primaryFilter === 'Tout' || primaryFilter === 'Ressources';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Filter bar */}
      <div
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
              type="button"
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
                    background: '#ffffff',
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
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  minWidth: 220,
                  background: 'white',
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

        {/* Count */}
        <span
          style={{
            fontSize: 13,
            color: 'var(--color-text-muted)',
            marginLeft: 'auto',
          }}
        >
          {pluralizeCount(filteredItems.length, primaryFilter)}
        </span>
      </div>

      {/* Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) =>
            item.category === 'resource' ? (
              <ResourceCard
                key={item.slug}
                resource={item}
                currentCapability={currentCapability}
              />
            ) : (
              <TemplateCard
                key={item.slug}
                template={item}
                currentCapability={currentCapability}
              />
            )
          )}
        </div>
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
