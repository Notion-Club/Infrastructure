import type { ReactNode } from 'react';

export type BadgeType = 'pill-color' | 'color' | 'modern';
export type BadgeColor = 'brand' | 'blue' | 'purple' | 'green' | 'orange' | 'gray';

interface BadgeWithDotProps {
  type: BadgeType;
  color: BadgeColor;
  children: ReactNode;
}

const PALETTE: Record<
  BadgeColor,
  { bg: string; border: string; text: string; dot: string; solidBg: string }
> = {
  brand:  { solidBg: '#e0625a', bg: 'rgba(224,98,90,0.10)',  border: 'rgba(224,98,90,0.25)',  text: '#c44d45', dot: '#e0625a' },
  blue:   { solidBg: '#3b82f6', bg: 'rgba(37,99,235,0.10)',  border: 'rgba(37,99,235,0.22)',  text: '#1d4ed8', dot: '#3b82f6' },
  purple: { solidBg: '#8b5cf6', bg: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.22)', text: '#6d28d9', dot: '#8b5cf6' },
  green:  { solidBg: '#22c55e', bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.22)',  text: '#15803d', dot: '#22c55e' },
  orange: { solidBg: '#f97316', bg: 'rgba(234,88,12,0.10)',  border: 'rgba(234,88,12,0.22)',  text: '#c2410c', dot: '#f97316' },
  gray:   { solidBg: '#94a3b8', bg: 'var(--color-surface-raised)', border: 'var(--color-border-default)', text: 'var(--color-text-secondary)', dot: '#94a3b8' },
};

export function BadgeWithDot({ type, color, children }: BadgeWithDotProps) {
  const p = PALETTE[color];

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px 4px 8px',
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  if (type === 'pill-color') {
    return (
      <span
        style={{
          ...baseStyle,
          borderRadius: 9999,
          background: p.bg,
          color: p.text,
          border: 'none',
        }}
      >
        <Dot color={p.dot} />
        {children}
      </span>
    );
  }

  if (type === 'color') {
    // Colored tinted background — used for formation, category
    return (
      <span
        style={{
          ...baseStyle,
          borderRadius: 8,
          background: p.bg,
          color: p.text,
          border: 'none',
        }}
      >
        <Dot color={p.dot} />
        {children}
      </span>
    );
  }

  // type === 'modern' — white background, colored dot + text, subtle border
  return (
    <span
      style={{
        ...baseStyle,
        borderRadius: 8,
        background: 'var(--color-surface-raised)',
        color: p.text,
        border: `1px solid ${p.border}`,
      }}
    >
      <Dot color={p.dot} />
      {children}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
