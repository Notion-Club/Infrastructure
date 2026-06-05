'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatSeenDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// TODO(backend) : persister la date de vu côté Supabase quand l'auth réelle
// sera branchée. Pour l'instant, l'état est local au composant et perdu au
// rafraîchissement. La date affichée doit être celle stockée en base, pas
// celle calculée à l'affichage. Cf. commentaire sur la PR.
export function MarkAsSeenButton() {
  const [seenAt, setSeenAt] = useState<Date | null>(null);
  const seen = seenAt !== null;

  return (
    <div>
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--color-border-default)',
          margin: '0 0 24px',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          data-fb-label="Bouton Marquer comme vue · Page ressource"
          onClick={() => setSeenAt(new Date())}
          disabled={seen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            borderRadius: 9999,
            fontSize: 14,
            fontWeight: 600,
            color: seen ? 'var(--color-text-muted)' : '#ffffff',
            background: seen ? 'var(--color-surface-raised)' : 'var(--color-brand)',
            border: '1px solid',
            borderColor: seen ? 'var(--color-border-default)' : 'var(--color-brand)',
            cursor: seen ? 'default' : 'pointer',
            boxShadow: seen ? 'none' : '0 2px 8px rgba(224,98,90,0.25)',
            transition: 'all 150ms ease',
          }}
          className={!seen ? 'hover:opacity-90' : ''}
        >
          {seen && seenAt ? (
            <>
              <Check size={16} />
              Vu le {formatSeenDate(seenAt)}
            </>
          ) : (
            'Marquer comme vue'
          )}
        </button>
      </div>
    </div>
  );
}
