'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { Template, UserCapability } from '../types';
import { ResourceBadge } from './shared/ResourceBadge';

interface TemplateCardProps {
  template: Template;
  currentCapability: UserCapability;
}

export function TemplateCard({ template, currentCapability }: TemplateCardProps) {
  const router = useRouter();
  const isLocked = currentCapability === 'challenge';

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
      className="hover:-translate-y-0.5 hover:shadow-[rgba(0,0,0,0.10)_0px_8px_32px_0px]"
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-default)',
        boxShadow: 'var(--nc-shadow-3)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <ResourceBadge variant="template" label="Template" />
        {isLocked && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-muted)',
            }}
          >
            <Lock size={10} />
            Membres
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <ResourceBadge variant="type" label={template.type} />
      </div>
    </div>
  );
}
