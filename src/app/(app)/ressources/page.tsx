import { Suspense } from 'react';
import { ResourcesGrid } from '@/modules/ressources/components/ResourcesGrid';
import { getAllResourceItems } from '@/modules/ressources/lib/fetch';

export default async function RessourcesPage() {
  const items = await getAllResourceItems();

  return (
    <>
      {/* Pas de bandeau bas `GradualBlurOverlay` : il créait un voile blanchâtre
          (backdrop-filter fixe) qui ne se repeignait pas au switch de thème sur
          iOS. On s'aligne sur Settings/Formation — le contenu scrolle derrière
          la BottomNav translucide, avec le padding `pb-[176px]` pour dégager la
          dernière ligne. Cf. docs/pwa/safari-web-pwa-integration.md. */}
      <div className="nc-page-halo" style={{ minHeight: '100lvh' }}>
        <main style={{ position: 'relative', zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[176px] md:px-10 md:pt-[148px] md:pb-[140px]">
            <div
              style={{
                // Contenu aligné sur la barre de navigation (pill 920px). Ici le
                // padding horizontal (px-10) est porté par le div PARENT et non
                // par cet élément → on cible donc directement 920 (et non 1000
                // comme les pages où padding+maxWidth sont sur le même élément).
                maxWidth: 920,
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
