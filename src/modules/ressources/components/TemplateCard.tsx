'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { Template, UserCapability } from '../types';
import { canAccess } from '../lib/access';
import { ResourceBadge } from './shared/ResourceBadge';

interface TemplateCardProps {
  template: Template;
  currentCapability: UserCapability;
}

export function TemplateCard({ template, currentCapability }: TemplateCardProps) {
  const router = useRouter();
  const isLocked = !canAccess(currentCapability, template.visibilite);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push('/ressources/template/' + template.slug)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push('/ressources/template/' + template.slug);
        }
      }}
      className="group hover:border-[rgba(224,98,90,0.32)]"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-border-default)',
        boxShadow: 'var(--nc-shadow-3)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transition: 'border-color 350ms cubic-bezier(0.22, 1, 0.36, 1)',
        position: 'relative',
        overflow: 'hidden',
        viewTransitionName: `card-${template.slug}`,
      }}
    >
      <div
        aria-hidden
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 160,
          height: 160,
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(circle, var(--nc-card-dot-color) 1px, transparent 1.4px)',
          backgroundSize: '11px 11px',
          maskImage:
            'radial-gradient(circle at top right, black 0%, transparent 70%)',
          WebkitMaskImage:
            'radial-gradient(circle at top right, black 0%, transparent 70%)',
        }}
      />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <ResourceBadge variant="template" label="Template" />
        {isLocked && (
          <ResourceBadge variant="neutral" label={template.visibilite} icon={<Lock size={10} />} />
        )}
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <h3
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
  );
}
