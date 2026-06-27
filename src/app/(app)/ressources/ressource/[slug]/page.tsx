import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getResourceBySlug, getRelatedResources } from '@/modules/ressources/lib/fetch';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceBreadcrumb } from '@/modules/ressources/components/shared/ResourceBreadcrumb';
import { ResourceBadge } from '@/modules/ressources/components/shared/ResourceBadge';
import { ResourceContentBody } from '@/modules/ressources/components/shared/ResourceContentBody';
import { ResourcePageFooter } from '@/modules/ressources/components/shared/ResourcePageFooter';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// Encadré : même fond + bordure que la carte, radius 24px. La transition
// carte → encadré est portée par le morph WAAPI (overlay), plus par le View
// Transition (retiré : inerte depuis que les cartes ouvrent l'overlay en place).
const encadreStyle: React.CSSProperties = {
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--nc-radius-md)',
  padding: '32px',
  boxShadow: 'var(--nc-shadow-3)',
  marginBottom: 32,
};

const pulse: React.CSSProperties = {
  animation: 'nc-skeleton-pulse 1.6s ease-in-out infinite',
  background: 'var(--color-surface-raised)',
  borderRadius: 'var(--nc-radius-xs)',
};

// Skeleton affiché pendant le fetch Notion sur accès direct / refresh.
function ResourceDetailSkeleton() {
  return (
    <>
      <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...pulse, height: 30, width: 168, borderRadius: 9999 }} />
        <div style={{ ...pulse, height: 14, width: 220, borderRadius: 8, animationDelay: '60ms' }} />
      </div>
      <div style={{ ...encadreStyle, minHeight: 420 }}>
        <div style={{ ...pulse, height: 46, width: '72%', borderRadius: 'var(--nc-radius-sm)' }} />
        <div style={{ ...pulse, height: 16, width: '94%', marginTop: 20, borderRadius: 8, animationDelay: '60ms' }} />
        <div style={{ ...pulse, height: 16, width: '60%', marginTop: 10, borderRadius: 8, animationDelay: '100ms' }} />
        <div style={{ ...pulse, height: 13, width: 120, marginTop: 20, borderRadius: 8, animationDelay: '140ms' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {[96, 120, 84].map((w, i) => (
            <div key={w} style={{ ...pulse, height: 24, width: w, borderRadius: 9999, animationDelay: `${160 + i * 40}ms` }} />
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--color-border-default)', margin: '28px 0' }} />
        {['100%', '96%', '88%', '92%', '70%'].map((w, i) => (
          <div key={w} style={{ ...pulse, height: 14, width: w, marginTop: i === 0 ? 0 : 12, borderRadius: 8, animationDelay: `${200 + i * 40}ms` }} />
        ))}
      </div>
    </>
  );
}

async function ResourceDetailContent({ slug }: { slug: string }) {
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  const relatedResources = getRelatedResources();

  return (
    <>
      <div data-fb-label="Fil d'ariane · Page ressource" style={{ marginBottom: 32 }}>
        <ResourceBreadcrumb
          items={[
            ...(resource.type[0]
              ? [{ label: resource.type[0], href: `/ressources?type=${encodeURIComponent(resource.type[0])}` }]
              : []),
            { label: resource.titre },
          ]}
        />
      </div>

      <div data-fb-label="Encadré contenu · Page ressource" style={encadreStyle}>
        <h1
          data-fb-label="Titre · Page ressource"
          style={{
            fontSize: 'clamp(36px, 5vw, 52px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--color-text-primary)',
            margin: '0 0 16px',
            lineHeight: 1.1,
          }}
        >
          {resource.titre}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: 'var(--color-text-secondary)',
            margin: '0 0 16px',
            lineHeight: 1.6,
          }}
        >
          {resource.description}
        </p>
        <div
          style={{
            fontSize: 13,
            color: 'var(--color-text-muted)',
            marginBottom: 16,
          }}
        >
          {formatDate(resource.dateCreation)}
        </div>
        <div data-fb-label="Badges méta · Page ressource" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ResourceBadge variant="ressource" label="Ressource" />
          {resource.formation.map((f) => (
            <ResourceBadge key={f} variant="formation" label={f} />
          ))}
          {resource.type.map((t) => (
            <ResourceBadge key={t} variant="type" label={t} />
          ))}
        </div>

        <ResourceContentBody resource={resource} />
      </div>

      <ResourcePageFooter
        relatedResources={relatedResources}
        currentCapability={mockCurrentUser.capability}
      />
    </>
  );
}

export default async function ResourceDetailPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <>
      {/* Pas de `GradualBlurOverlay` (cf. docs/pwa/safari-web-pwa-integration.md) :
          aligné sur Settings/Formation, contenu derrière la BottomNav translucide. */}
      <div className="nc-page-halo" style={{ minHeight: '100lvh' }}>
        <main style={{ position: 'relative', zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              {/* Le shell ne suspend pas (await params seulement) → la grille
                  loading.tsx parente ne s'affiche pas ; seul ce Suspense interne
                  pilote le skeleton. */}
              <Suspense fallback={<ResourceDetailSkeleton />}>
                <ResourceDetailContent slug={slug} />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
