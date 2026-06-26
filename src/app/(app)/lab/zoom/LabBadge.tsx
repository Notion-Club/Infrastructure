// Pills mockées répliquant la DNA visuelle de `ResourceBadge` (catégorie /
// formation / type), sans dépendre du module /ressources réel (isolation lab).

type LabBadgeKind = 'ressource' | 'formation' | 'type';

// Couleurs alignées sur ResourceBadge.tsx (CATEGORY_STYLES + FORMATION/TYPE).
const PALETTE: Record<string, { bg: string; color: string; dot: string }> = {
  // Catégorie "Ressource"
  ressource: { bg: 'rgba(37,99,235,0.10)', color: '#1d4ed8', dot: '#3b82f6' },
  // Formations
  'Notion Business': { bg: 'rgba(37,99,235,0.10)', color: '#1d4ed8', dot: '#3b82f6' },
  'Notion Architecte': { bg: 'rgba(224,98,90,0.12)', color: '#c0392b', dot: '#e0625a' },
  // Types métier
  'Relation Client': { bg: 'rgba(224,98,90,0.12)', color: '#c0392b', dot: '#e0625a' },
  Production: { bg: 'rgba(37,99,235,0.10)', color: '#1d4ed8', dot: '#3b82f6' },
  Acquisition: { bg: 'rgba(34,197,94,0.10)', color: '#15803d', dot: '#22c55e' },
  Sales: { bg: 'rgba(124,58,237,0.10)', color: '#6d28d9', dot: '#8b5cf6' },
  Business: { bg: 'rgba(234,88,12,0.10)', color: '#c2410c', dot: '#f97316' },
  'Rediffusion de Live': { bg: 'rgba(0,0,0,0.06)', color: '#52525b', dot: '#9b9a97' },
};

const FALLBACK = { bg: 'rgba(0,0,0,0.06)', color: '#52525b', dot: '#9b9a97' };

export function LabBadge({ kind, label }: { kind: LabBadgeKind; label: string }) {
  const key = kind === 'ressource' ? 'ressource' : label;
  const s = PALETTE[key] ?? FALLBACK;
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
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }}
      />
      {kind === 'ressource' ? 'Ressource' : label}
    </span>
  );
}
