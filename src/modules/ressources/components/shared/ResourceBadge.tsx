import type { ReactNode } from 'react';

type BadgeVariant = 'ressource' | 'template' | 'formation' | 'type' | 'neutral';

interface ResourceBadgeProps {
  variant: BadgeVariant;
  label: string;
  icon?: ReactNode;
}

interface BadgeStyle {
  background: string;
  color: string;
  dot: string;
}

const STYLES: Record<Exclude<BadgeVariant, 'formation'>, BadgeStyle> = {
  ressource: {
    background: 'rgba(37, 99, 235, 0.10)',
    color: '#1d4ed8',
    dot: '#3b82f6',
  },
  template: {
    background: 'rgba(124, 58, 237, 0.10)',
    color: '#6d28d9',
    dot: '#8b5cf6',
  },
  type: {
    background: 'var(--color-surface-raised)',
    color: 'var(--color-text-secondary)',
    dot: '#9b9a97',
  },
  neutral: {
    background: 'var(--color-surface-raised)',
    color: 'var(--color-text-muted)',
    dot: '#9b9a97',
  },
};

const FORMATION_STYLES: Record<string, BadgeStyle> = {
  'Notion Business': {
    background: 'rgba(37, 99, 235, 0.10)',
    color: '#1d4ed8',
    dot: '#3b82f6',
  },
  'Notion Architecte': {
    background: 'rgba(224, 98, 90, 0.10)',
    color: 'var(--color-brand)',
    dot: 'var(--color-brand)',
  },
};

function getStyle(variant: BadgeVariant, label: string): BadgeStyle {
  if (variant === 'formation') {
    return FORMATION_STYLES[label] ?? STYLES.neutral;
  }
  return STYLES[variant];
}

export function ResourceBadge({ variant, label, icon }: ResourceBadgeProps) {
  const style = getStyle(variant, label);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px 4px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        background: style.background,
        color: style.color,
        border: 'none',
      }}
    >
      {icon ?? (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: style.dot,
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}
