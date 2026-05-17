type BadgeVariant = 'ressource' | 'template' | 'formation' | 'type';

interface ResourceBadgeProps {
  variant: BadgeVariant;
  label: string;
}

const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  ressource: {
    background: 'rgba(37,99,235,0.08)',
    border: '1px solid rgba(37,99,235,0.2)',
    color: '#2563eb',
  },
  template: {
    background: 'rgba(124,58,237,0.08)',
    border: '1px solid rgba(124,58,237,0.2)',
    color: '#7c3aed',
  },
  formation: {
    background: 'rgba(224,98,90,0.08)',
    border: '1px solid rgba(224,98,90,0.2)',
    color: 'var(--color-brand)',
  },
  type: {
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border-default)',
    color: 'var(--color-text-secondary)',
  },
};

export function ResourceBadge({ variant, label }: ResourceBadgeProps) {
  return (
    <span
      style={{
        ...VARIANT_STYLES[variant],
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}
