'use client';

import { useRef } from 'react';
import { Lock } from 'lucide-react';
import type { Resource, UserCapability } from '../types';
import { canAccess } from '../lib/access';
import { ResourceBadge } from './shared/ResourceBadge';
import { useMorph } from './morph/MorphSourceContext';

interface ResourceCardProps {
  resource: Resource;
  currentCapability: UserCapability;
}

export function ResourceCard({ resource, currentCapability }: ResourceCardProps) {
  const isLocked = !canAccess(currentCapability, resource.visibilite);
  const { open } = useMorph();
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Clic gauche simple : on ouvre l'overlay de morph EN PLACE (aucune navigation,
  // la donnée est déjà en mémoire). On capture la géométrie carte + titre comme
  // point de départ. Cmd/Ctrl/clic-milieu : on laisse le navigateur ouvrir la
  // vraie page (`href`) dans un nouvel onglet.
  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!cardRef.current) return;
    e.preventDefault();
    open({
      item: resource,
      cardRect: cardRef.current.getBoundingClientRect(),
      titleRect: (titleRef.current ?? cardRef.current).getBoundingClientRect(),
      triggerEl: e.currentTarget as HTMLElement,
    });
  };

  return (
    <a
      href={'/ressources/ressource/' + resource.slug}
      onClick={handleClick}
      style={{ display: 'block', height: '100%', textDecoration: 'none', color: 'inherit' }}
    >
      <div
        ref={cardRef}
        data-fb-label={`Carte ressource « ${resource.titre} » · Grille des ressources`}
        className="group hover:border-[rgba(224,98,90,0.32)]"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--nc-shadow-3)',
          borderRadius: 16,
          padding: 20,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          cursor: 'pointer',
          transition: 'border-color 350ms cubic-bezier(0.22, 1, 0.36, 1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <ResourceBadge variant="ressource" label="Ressource" />
          {isLocked && (
            <span data-fb-label="Cadenas accès · Carte ressource">
              <ResourceBadge variant="neutral" label={resource.visibilite} icon={<Lock size={10} />} />
            </span>
          )}
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <h3 ref={titleRef} style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.4 }}>
            {resource.titre}
          </h3>
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

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {resource.formation.map((f) => (
            <ResourceBadge key={f} variant="formation" label={f} />
          ))}
          {resource.type.map((t) => (
            <ResourceBadge key={t} variant="type" label={t} />
          ))}
        </div>
      </div>
    </a>
  );
}
