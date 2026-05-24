'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { Resource, UserCapability } from '../types';
import { canAccess } from '../lib/access';
import { ResourceBadge } from './shared/ResourceBadge';

interface ResourceCardProps {
  resource: Resource;
  currentCapability: UserCapability;
}

export function ResourceCard({ resource, currentCapability }: ResourceCardProps) {
  const router = useRouter();
  const isLocked = !canAccess(currentCapability, resource.visibilite);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push('/ressources/ressource/' + resource.slug)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push('/ressources/ressource/' + resource.slug);
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
        viewTransitionName: `card-${resource.slug}`,
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
        <ResourceBadge variant="ressource" label="Ressource" />
        {isLocked && (
          <ResourceBadge variant="neutral" label={resource.visibilite} icon={<Lock size={10} />} />
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
  );
}
