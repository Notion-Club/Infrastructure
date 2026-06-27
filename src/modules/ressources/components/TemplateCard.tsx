'use client';

import { useRef } from 'react';
import { Lock } from 'lucide-react';
import type { Template, UserCapability } from '../types';
import { canAccess } from '../lib/access';
import { ResourceBadge } from './shared/ResourceBadge';
import { useMorph } from './morph/MorphSourceContext';

interface TemplateCardProps {
  template: Template;
  currentCapability: UserCapability;
}

export function TemplateCard({ template, currentCapability }: TemplateCardProps) {
  const isLocked = !canAccess(currentCapability, template.visibilite);
  const { open } = useMorph();
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Même mécanique que ResourceCard : clic gauche simple → overlay de morph en
  // place (donnée déjà en mémoire). Cmd/Ctrl/clic-milieu → vraie page (`href`).
  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!cardRef.current) return;
    e.preventDefault();
    open({
      item: template,
      cardRect: cardRef.current.getBoundingClientRect(),
      titleRect: (titleRef.current ?? cardRef.current).getBoundingClientRect(),
    });
  };

  return (
    <a
      href={'/ressources/template/' + template.slug}
      onClick={handleClick}
      style={{ display: 'block', height: '100%', textDecoration: 'none', color: 'inherit' }}
    >
      <div
        ref={cardRef}
        data-fb-label={`Carte template « ${template.titre} » · Grille des ressources`}
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
          <ResourceBadge variant="template" label="Template" />
          {isLocked && (
            <span data-fb-label="Cadenas accès · Carte template">
              <ResourceBadge variant="neutral" label={template.visibilite} icon={<Lock size={10} />} />
            </span>
          )}
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <h3
            ref={titleRef}
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {template.titre}
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
            {template.description}
          </p>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <ResourceBadge variant="type" label={template.type} />
        </div>
      </div>
    </a>
  );
}
