import { Suspense } from 'react';
import { ResourceMorphOverlay } from '@/modules/ressources/components/morph/ResourceMorphOverlay';
import { ResourceDetailBody } from '@/modules/ressources/components/ResourceDetailBody';

interface Props {
  params: Promise<{ slug: string }>;
}

// Page détail INTERCOPTÉE → rendue dans l'overlay de morph au-dessus de la grille.
// Le header (titre/desc/badges) vient des données de la carte (contexte, instantané) ;
// le CORPS Notion réel est fetché ici (RSC) et streamé dans l'encadré (Suspense).
export default async function InterceptedResourcePage({ params }: Props) {
  const { slug } = await params;

  // key={slug} : remonte un overlay NEUF à chaque ressource → l'effet de morph
  // re-tourne et aucune animation de la précédente ne persiste (le slot @modal
  // peut réutiliser/garder l'instance entre deux ressources).
  return (
    <ResourceMorphOverlay key={slug}>
      <Suspense fallback={<BodySkeleton />}>
        <ResourceDetailBody slug={slug} />
      </Suspense>
    </ResourceMorphOverlay>
  );
}

function BodySkeleton() {
  const pulse: React.CSSProperties = {
    animation: 'nc-skeleton-pulse 1.6s ease-in-out infinite',
    background: 'var(--color-surface-raised)',
    borderRadius: 8,
  };
  return (
    <div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: '28px 0' }} />
      {['100%', '96%', '88%', '92%', '70%', '84%'].map((w, i) => (
        <div key={w} style={{ ...pulse, height: 14, width: w, marginTop: i === 0 ? 0 : 12, animationDelay: `${i * 40}ms` }} />
      ))}
    </div>
  );
}
