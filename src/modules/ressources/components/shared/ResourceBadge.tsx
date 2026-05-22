import type { ReactNode } from 'react';
import { BadgeWithDot } from '@/components/base/badges/badges';
import type { BadgeColor } from '@/components/base/badges/badges';

type BadgeVariant = 'ressource' | 'template' | 'formation' | 'type' | 'neutral';

interface ResourceBadgeProps {
  variant: BadgeVariant;
  label: string;
  icon?: ReactNode;
}

// Color per formation name — type="color" (tinted background)
const FORMATION_COLOR: Record<string, BadgeColor> = {
  'Notion Business': 'blue',
  'Notion Architecte': 'brand',
};

// Color per type label — type="modern" (white bg, colored dot)
const TYPE_COLOR: Record<string, BadgeColor> = {
  // ResourceMetierType
  'Relation Client':     'brand',
  'Production':          'blue',
  'Acquisition':         'green',
  'Sales':               'purple',
  'Business':            'orange',
  'Rediffusion de Live': 'gray',
  // TemplateType
  'Pour les Consultants Notion': 'purple',
  'Système Généraliste':         'blue',
};

// Category badges (Ressource / Template) keep the original pill style
const CATEGORY_STYLES: Record<'ressource' | 'template', { bg: string; color: string; dot: string }> = {
  ressource: { bg: 'rgba(37,99,235,0.10)',  color: '#1d4ed8', dot: '#3b82f6' },
  template:  { bg: 'rgba(124,58,237,0.10)', color: '#6d28d9', dot: '#8b5cf6' },
};

export function ResourceBadge({ variant, label, icon }: ResourceBadgeProps) {
  // Formation → BadgeWithDot type="color"
  if (variant === 'formation') {
    const color = FORMATION_COLOR[label] ?? 'gray';
    return <BadgeWithDot type="color" color={color}>{label}</BadgeWithDot>;
  }

  // Type métier / Template type → BadgeWithDot type="modern"
  if (variant === 'type') {
    const color = TYPE_COLOR[label] ?? 'gray';
    return <BadgeWithDot type="modern" color={color}>{label}</BadgeWithDot>;
  }

  // Neutral (lock badge) — keep existing style, icon support
  if (variant === 'neutral') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px 4px 8px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          background: 'var(--color-surface-raised)',
          color: 'var(--color-text-muted)',
        }}
      >
        {icon ?? <Dot color="#9b9a97" />}
        {label}
      </span>
    );
  }

  // Ressource / Template category pills
  const s = CATEGORY_STYLES[variant as 'ressource' | 'template'];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px 4px 10px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        background: s.bg,
        color: s.color,
      }}
    >
      <Dot color={s.dot} />
      {label}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}
    />
  );
}
