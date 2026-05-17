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
}

const STYLES: Record<Exclude<BadgeVariant, 'formation'>, BadgeStyle> = {
  ressource: { background: '#5B6B7D', color: '#ffffff' },
  template: { background: '#7C5F94', color: '#ffffff' },
  type: { background: '#787774', color: '#ffffff' },
  neutral: { background: '#9B9A97', color: '#ffffff' },
};

const FORMATION_STYLES: Record<string, BadgeStyle> = {
  'Notion Business': { background: '#4A78A8', color: '#ffffff' },
  'Notion Architecte': { background: '#A85248', color: '#ffffff' },
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
        gap: icon ? 5 : 0,
        padding: '3px 8px',
        borderRadius: 4,
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
      {icon}
      {label}
    </span>
  );
}
