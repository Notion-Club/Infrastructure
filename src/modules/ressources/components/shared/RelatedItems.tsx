import type { ResourceItem, UserCapability } from '../../types';
import { ResourceCard } from '../ResourceCard';
import { TemplateCard } from '../TemplateCard';

interface RelatedItemsProps {
  items: ResourceItem[];
  currentCapability: UserCapability;
  heading: string;
}

export function RelatedItems({ items, currentCapability, heading }: RelatedItemsProps) {
  if (!items.length) return null;

  return (
    <section style={{ marginTop: 56 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--color-text-primary)',
          margin: '0 0 20px',
        }}
      >
        {heading}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {items.map((item) =>
          item.category === 'resource' ? (
            <ResourceCard
              key={item.slug}
              resource={item}
              currentCapability={currentCapability}
            />
          ) : (
            <TemplateCard
              key={item.slug}
              template={item}
              currentCapability={currentCapability}
            />
          )
        )}
      </div>
    </section>
  );
}
