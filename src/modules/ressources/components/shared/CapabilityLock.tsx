import { Lock } from 'lucide-react';

interface CapabilityLockProps {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export function CapabilityLock({ title, description, ctaLabel, ctaHref }: CapabilityLockProps) {
  return (
    <div
      data-fb-label="Encadré Accès verrouillé · Page ressource"
      style={{
        background: 'rgba(224,98,90,0.04)',
        border: '1px solid rgba(224,98,90,0.15)',
        borderRadius: 16,
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(224,98,90,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Lock size={24} style={{ color: 'var(--color-brand)' }} />
      </div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          margin: 0,
          lineHeight: 1.6,
          maxWidth: 420,
        }}
      >
        {description}
      </p>
      <a
        href={ctaHref}
        data-fb-label="Bouton Découvrir les offres · Encadré Accès verrouillé"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '11px 24px',
          borderRadius: 9999,
          background: 'var(--color-brand)',
          color: 'white',
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'opacity 150ms ease',
          marginTop: 4,
        }}
        className="hover:opacity-85"
      >
        {ctaLabel}
      </a>
    </div>
  );
}
