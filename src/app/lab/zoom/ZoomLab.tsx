'use client';

import { useState } from 'react';
import { LAB_RESOURCES, type LabResource } from './mock';
import { LabCard } from './LabCard';
import { ZoomOverlay, type ZoomSource } from './ZoomOverlay';

// Étape 2 — le morph. Clic carte → clone `position: fixed` qui grandit (spring
// WAAPI) depuis le rect EXACT de la carte vers l'encadré, titre ancré + cross-
// fade temporisé. La grille reste montée et IMMOBILE derrière. Fond = vrai
// `.nc-app-bg` hérité du root layout.
export function ZoomLab() {
  const [active, setActive] = useState<ZoomSource | null>(null);

  const open = (resource: LabResource, surface: HTMLElement) => {
    // Géométrie capturée AVANT tout changement DOM → la grille ne bouge pas,
    // le rect reste valide. Position via getBoundingClientRect (jamais vh).
    const cardRect = surface.getBoundingClientRect();
    const titleEl = surface.querySelector('[data-lab-card-title]') as HTMLElement | null;
    const titleRect = (titleEl ?? surface).getBoundingClientRect();
    setActive({ resource, cardRect, titleRect });
  };

  return (
    <main style={{ position: 'relative', zIndex: 1 }}>
      <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <header style={{ marginBottom: 24 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                background: 'rgba(224,98,90,0.12)',
                color: '#c0392b',
              }}
            >
              Lab · dev-only
            </span>
            <h1
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--color-text-primary)',
                margin: '12px 0 4px',
                lineHeight: 1.1,
              }}
            >
              Zoom-transition — prototype
            </h1>
            <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Étape 2 : clique une carte → morph spring vers l’encadré, titre ancré, grille immobile.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {LAB_RESOURCES.map((resource) => (
              <div key={resource.slug} className="nc-grid-card" data-card-id={resource.slug}>
                <LabCard resource={resource} onOpen={open} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {active && <ZoomOverlay source={active} onClosed={() => setActive(null)} />}
    </main>
  );
}
