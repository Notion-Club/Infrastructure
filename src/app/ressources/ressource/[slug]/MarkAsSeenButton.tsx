'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

export function MarkAsSeenButton() {
  const [seen, setSeen] = useState(false);

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
          onClick={() => setSeen(true)}
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
          {seen ? (
            <>
              <Check size={16} />
              Marquée comme vue
            </>
          ) : (
            'Marquer comme vue'
          )}
        </button>
      </div>
    </div>
  );
}
