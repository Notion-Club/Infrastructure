import { Suspense } from 'react';
import { Topbar } from '@/shared/components/dashboard/Topbar';
import { MobileTopActions } from '@/shared/components/dashboard/mobile/MobileTopActions';
import { BottomNav } from '@/shared/components/dashboard/mobile/BottomNav';
import { ResourcesGrid } from '@/modules/ressources/components/ResourcesGrid';
import { getAllResourceItems } from '@/modules/ressources/lib/fetch';
import { GradualBlurOverlay } from '@/shared/components/GradualBlurOverlay';

export default async function RessourcesPage() {
  const items = await getAllResourceItems();

  return (
    <>
      <Topbar />
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>
      <GradualBlurOverlay />
      <div className="nc-page-halo" style={{ minHeight: '100dvh' }}>
        <main style={{ position: 'relative', zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
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
                    fontSize: 'clamp(42px, 6vw, 64px)',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
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
