'use client';

import { Lightbulb } from 'lucide-react';

const FILLOUT_FORM_URL = '#';

type SuggestVariant = 'Tout' | 'Ressources' | 'Templates';

const COPY: Record<SuggestVariant, { title: string; subtitle: string; button: string }> = {
  Tout: {
    title: 'Tu cherches une ressource ?',
    subtitle: 'Nous développons les ressources dont tu as besoin. Clique pour renseigner ton idée.',
    button: 'Suggérer une ressource',
  },
  Ressources: {
    title: 'Tu cherches une ressource ?',
    subtitle: 'Nous développons les ressources dont tu as besoin. Clique pour renseigner ton idée.',
    button: 'Suggérer une ressource',
  },
  Templates: {
    title: 'Tu cherches un template ?',
    subtitle: 'Nous développons les templates dont tu as besoin. Clique pour renseigner ton idée.',
    button: 'Suggérer un template',
  },
};

interface SuggestCardProps {
  variant: SuggestVariant;
}

export function SuggestTemplateCard({ variant }: SuggestCardProps) {
  const copy = COPY[variant];

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '2px dashed var(--color-border-default)',
        borderRadius: 16,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'flex-start',
        justifyContent: 'center',
        minHeight: 180,
        boxShadow: 'var(--nc-shadow-3)',
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
          {copy.title}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {copy.subtitle}
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
        {copy.button}
      </a>
    </div>
  );
}
