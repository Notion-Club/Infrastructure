'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Resource, UserCapability } from '../../types';
import { ResourceCard } from '../ResourceCard';

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatSeenDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

interface ResourcePageFooterProps {
  relatedResources: Resource[];
  currentCapability: UserCapability;
}

// TODO(backend): transmettre la date "vu le" depuis Supabase (table
// user_resource_views) et persister le clic via un INSERT upsert.
export function ResourcePageFooter({ relatedResources, currentCapability }: ResourcePageFooterProps) {
  const [seenAt, setSeenAt] = useState<Date | null>(null);
  const seen = seenAt !== null;

  return (
    <div style={{ marginTop: 48 }}>
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--color-border-default)',
          margin: '0 0 32px',
        }}
      />

      {/* Marquer comme vue */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => setSeenAt(new Date())}
          disabled={seen}
          className={!seen ? 'nc-btn-shine' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 28px',
            borderRadius: 9999,
            fontSize: 14,
            fontWeight: 600,
            color: seen ? 'var(--color-text-muted)' : '#ffffff',
            background: seen ? 'var(--color-surface-raised)' : 'var(--color-brand)',
            border: '1px solid',
            borderColor: seen ? 'var(--color-border-default)' : 'var(--color-brand)',
            cursor: seen ? 'default' : 'pointer',
            boxShadow: seen ? 'none' : '0 4px 16px rgba(224,98,90,0.35)',
            transition: 'all 150ms ease',
          }}
        >
          {seen && seenAt ? (
            <>
              <Check size={15} />
              Vu le {formatSeenDate(seenAt)}
            </>
          ) : (
            'Marquer comme vue'
          )}
        </button>
      </div>

      {/* Ressources liées */}
      {relatedResources.length > 0 && (
        <>
          <hr
            style={{
              border: 'none',
              borderTop: '1px solid var(--color-border-default)',
              margin: '40px 0 28px',
            }}
          />
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
              margin: '0 0 20px',
            }}
          >
            Ces ressources peuvent aussi t&apos;intéresser
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {relatedResources.map((r) => (
              <ResourceCard key={r.slug} resource={r} currentCapability={currentCapability} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
