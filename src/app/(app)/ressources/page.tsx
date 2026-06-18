import { Suspense } from 'react';
import { ResourcesGrid } from '@/modules/ressources/components/ResourcesGrid';
import { getAllResourceItems } from '@/modules/ressources/lib/fetch';
import { GradualBlurOverlay } from '@/shared/components/GradualBlurOverlay';

export default async function RessourcesPage() {
  const items = await getAllResourceItems();

  return (
    <>
      <GradualBlurOverlay />
      <div className="nc-page-halo" style={{ minHeight: '100dvh' }}>
        <main style={{ position: 'relative', zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[176px] md:px-10 md:pt-[148px] md:pb-[140px]">
            <div
              style={{
                maxWidth: 1040,
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 28,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                    margin: 0,
                  }}
                >
                  Bibliothèque
                </p>
                <h1
                  style={{
                    fontSize: 'clamp(32px, 4vw, 44px)',
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  Ressources
                </h1>
              </div>

              {/* Grid */}
              <Suspense fallback={null}>
                <ResourcesGrid items={items} />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
