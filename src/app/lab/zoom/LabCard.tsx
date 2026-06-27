'use client';

import type { LabResource } from './mock';
import { LabBadge } from './LabBadge';

interface LabCardProps {
  resource: LabResource;
  /** Ouverture du morph (Étape 2) — la grille reste montée et statique. */
  onOpen?: (resource: LabResource, surface: HTMLElement) => void;
}

// Réplique fidèle de la DNA `ResourceCard` : radius 16, padding 20, gap 12,
// titre h3 15px/600/1.4, description 13px/secondary/1.5 clamp 2 lignes.
// PAS le composant réel — carte mock isolée pour le prototype.
export function LabCard({ resource, onOpen }: LabCardProps) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen?.(resource, e.currentTarget.firstElementChild as HTMLElement)}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        padding: 0,
        border: 'none',
        background: 'none',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
      }}
    >
      <div
        data-lab-card={resource.slug}
        className="group hover:border-[rgba(224,98,90,0.32)]"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--nc-shadow-3)',
          borderRadius: 16,
          padding: 20,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          transition: 'border-color 350ms cubic-bezier(0.22, 1, 0.36, 1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <LabBadge kind="ressource" label="Ressource" />
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <h3
            data-lab-card-title={resource.slug}
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {resource.titre}
          </h3>
          <p
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              margin: 0,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {resource.description}
          </p>
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {resource.formation && <LabBadge kind="formation" label={resource.formation} />}
          {resource.type && <LabBadge kind="type" label={resource.type} />}
        </div>
      </div>
    </button>
  );
}
