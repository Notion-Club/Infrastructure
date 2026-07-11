'use client';

import { useState } from 'react';
import type { Resource } from '../../types';
import type { UserCapabilities } from '@/shared/types/capabilities';
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
  caps: UserCapabilities;
}

// TODO(backend): lire seenAt depuis Supabase (table user_resource_views,
// colonnes user_id + resource_id + viewed_at) et persister le clic via upsert.
export function ResourcePageFooter({ relatedResources, caps }: ResourcePageFooterProps) {
  const [seenAt, setSeenAt] = useState<Date | null>(null);
  const seen = seenAt !== null;
  const hasRelated = relatedResources.length > 0;

  return (
    <div
      data-fb-label="Pied de page ressource · Page ressource"
      style={{
        marginTop: 48,
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 20,
        boxShadow: 'var(--nc-shadow-3)',
        overflow: 'hidden',
      }}
    >
      {/* Bouton pleine largeur */}
      <button
        type="button"
        data-fb-label="Bouton Marquer comme vue · Pied de page ressource"
        onClick={() => setSeenAt(new Date())}
        disabled={seen}
        className={!seen ? 'nc-btn-shine' : ''}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '18px 24px',
          background: seen ? 'var(--color-surface-raised)' : 'var(--color-brand)',
          color: seen ? 'var(--color-text-muted)' : '#ffffff',
          fontSize: 15,
          fontWeight: 600,
          border: 'none',
          borderBottom: hasRelated ? '1px solid var(--color-border-default)' : 'none',
          cursor: seen ? 'default' : 'pointer',
          transition: 'opacity 150ms ease',
        }}
      >
        {seen && seenAt
          ? `Vu le ${formatSeenDate(seenAt)}`
          : 'Marquer comme vue ✓'}
      </button>

      {/* Ressources liées — uniquement si la liste n'est pas vide */}
      {hasRelated && (
        <div style={{ padding: '32px 24px' }}>
          <h2
            style={{
              fontSize: 'clamp(22px, 3.5vw, 28px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--color-text-primary)',
              margin: '0 0 24px',
              textAlign: 'center',
              lineHeight: 1.25,
            }}
          >
            Ces ressources peuvent aussi t&apos;intéresser
          </h2>
          <div
            data-fb-label="Grille ressources liées · Pied de page ressource"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {relatedResources.map((r) => (
              <ResourceCard key={r.slug} resource={r} caps={caps} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
