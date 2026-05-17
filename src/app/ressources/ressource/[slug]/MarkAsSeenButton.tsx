'use client';

import { useState } from 'react';

export function MarkAsSeenButton() {
  const [seen, setSeen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setSeen(true)}
      disabled={seen}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 20px',
        borderRadius: 9999,
        fontSize: 14,
        fontWeight: 500,
        color: seen ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
        background: seen ? 'var(--color-surface-raised)' : 'transparent',
        border: '1px solid',
        borderColor: seen ? 'var(--color-border-default)' : 'var(--color-border-default)',
        cursor: seen ? 'default' : 'pointer',
        transition: 'all 150ms ease',
      }}
      className={!seen ? 'hover:bg-[var(--color-surface-raised)]' : ''}
    >
      {seen ? 'Vu ✓' : 'Marquer comme vu'}
    </button>
  );
}
