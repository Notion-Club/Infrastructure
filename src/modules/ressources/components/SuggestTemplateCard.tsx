'use client';

import { Lightbulb } from 'lucide-react';

const FILLOUT_FORM_URL = '#';

export function SuggestTemplateCard() {
  return (
    <div
      style={{
        background: 'rgba(224,98,90,0.03)',
        border: '2px dashed var(--color-border-default)',
        borderRadius: 16,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'flex-start',
        justifyContent: 'center',
        minHeight: 180,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          Tu cherches un template ?
        </h3>
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Nous développons les templates dont tu as besoin.{' '}
          Clique pour renseigner ton idée.
        </p>
      </div>

      <a
        href={FILLOUT_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-brand)',
          background: 'rgba(224,98,90,0.08)',
          border: '1px solid rgba(224,98,90,0.2)',
          cursor: 'pointer',
          textDecoration: 'none',
          transition: 'background 150ms ease, border-color 150ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(224,98,90,0.13)';
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(224,98,90,0.35)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(224,98,90,0.08)';
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(224,98,90,0.2)';
        }}
      >
        <Lightbulb size={13} />
        Suggérer un template
      </a>
    </div>
  );
}
