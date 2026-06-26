'use client';

import { LAB_RESOURCES } from './mock';
import { LabCard } from './LabCard';

// Étape 1 — mini-grille statique (zéro animation). Le fond est le vrai
// `.nc-app-bg` hérité du root layout ; la grille reproduit la structure de
// `ResourcesGrid` (grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4, .nc-grid-card).
// Le morph (clic → encadré) arrive à l'Étape 2.
export function ZoomLab() {
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
              Étape 1 : grille statique à la DNA réelle des cartes /Ressources. Aucune animation pour l’instant.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {LAB_RESOURCES.map((resource) => (
              <div key={resource.slug} className="nc-grid-card" data-card-id={resource.slug}>
                <LabCard resource={resource} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
