import { Suspense, ViewTransition } from 'react';
import { notFound } from 'next/navigation';
import { GradualBlurOverlay } from '@/shared/components/GradualBlurOverlay';
import { getResourceBySlug, getRelatedResources } from '@/modules/ressources/lib/fetch';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceBreadcrumb } from '@/modules/ressources/components/shared/ResourceBreadcrumb';
import { ResourceBadge } from '@/modules/ressources/components/shared/ResourceBadge';
import { TellaEmbed } from '@/modules/ressources/components/shared/TellaEmbed';
import { CapabilityLock } from '@/modules/ressources/components/shared/CapabilityLock';
import { ResourcePageFooter } from '@/modules/ressources/components/shared/ResourcePageFooter';
import { canAccess } from '@/modules/ressources/lib/access';
import { heroVtName } from '@/modules/ressources/lib/heroTransition';
import type { ContentBlock } from '@/modules/ressources/types';

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

// DNA partagée carte ↔ encadré : même fond + bordure, border-radius 24px (la
// carte « s'ouvre » de 16px → 24px). Identique sur le skeleton et le contenu
// réel pour que le morph et le reveal soient continus.
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

function renderBlock(block: ContentBlock, idx: number) {
  switch (block.type) {
    case 'heading':
      if (block.level === 2) {
        return (
          <h2
            key={idx}
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: '32px 0 12px',
              lineHeight: 1.3,
            }}
          >
            {block.text}
          </h2>
        );
      }
      return (
        <h3
          key={idx}
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: '24px 0 10px',
            lineHeight: 1.4,
          }}
        >
          {block.text}
        </h3>
      );

    case 'paragraph':
      return (
        <p
          key={idx}
          style={{
            fontSize: 15,
            color: 'var(--color-text-secondary)',
            margin: '0 0 16px',
            lineHeight: 1.7,
          }}
        >
          {block.text}
        </p>
      );

    case 'list':
      return (
        <ul
          key={idx}
          style={{
            margin: '0 0 16px',
            paddingLeft: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {block.items.map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: 15,
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
              }}
            >
              {item.text}
              {item.children && item.children.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {item.children.map((child, j) => renderBlock(child, j))}
                </div>
              )}
            </li>
          ))}
        </ul>
      );

    case 'callout':
      return (
        <div
          key={idx}
          data-fb-label="Callout · Corps Notion"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 12,
            padding: '14px 16px',
            margin: '0 0 12px',
            display: 'flex',
            gap: 10,
          }}
        >
          {block.icon && (
            <span style={{ flexShrink: 0, fontSize: 16, lineHeight: '24px' }}>
              {block.icon}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {block.text && (
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--color-text-secondary)',
                  margin: '0 0 8px',
                  lineHeight: 1.7,
                }}
              >
                {block.text}
              </p>
            )}
            {block.children.map((child, i) => renderBlock(child, i))}
          </div>
        </div>
      );

    case 'quote':
      return (
        <blockquote
          key={idx}
          data-fb-label="Citation · Corps Notion"
          style={{
            borderLeft: '3px solid var(--color-border-default)',
            paddingLeft: 16,
            margin: '0 0 16px',
          }}
        >
          {block.text && (
            <p
              style={{
                fontSize: 15,
                color: 'var(--color-text-muted)',
                margin: 0,
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
            >
              {block.text}
            </p>
          )}
          {block.children.length > 0 && (
            <div>{block.children.map((child, i) => renderBlock(child, i))}</div>
          )}
        </blockquote>
      );

    case 'code':
      return (
        <pre
          key={idx}
          data-fb-label="Bloc code · Corps Notion"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 8,
            padding: '12px 16px',
            margin: '0 0 16px',
            overflowX: 'auto',
          }}
        >
          <code
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              fontFamily: 'monospace',
              lineHeight: 1.6,
            }}
          >
            {block.text}
          </code>
        </pre>
      );

    case 'tella_embed':
      return (
        <div key={idx} data-fb-label="Embed vidéo Tella · Corps Notion" style={{ margin: '24px 0' }}>
          <TellaEmbed url={block.url} />
        </div>
      );

    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={idx}
          data-fb-label="Image · Corps Notion"
          src={block.url}
          alt={block.alt ?? ''}
          style={{
            width: '100%',
            borderRadius: 12,
            margin: '24px 0',
          }}
        />
      );

    default: {
      const b = block as { type: string };
      console.warn(
        `[ressources/renderBlock] type ContentBlock non rendu : "${b.type}"`,
      );
      return null;
    }
  }
}

// Skeleton affiché pendant le fetch Notion. Son encadré porte le MÊME
// view-transition-name que la carte → la carte s'agrandit vers ce skeleton, puis
// le contenu réel se révèle par-dessus (reveal Suspense).
function ResourceDetailSkeleton({ slug }: { slug: string }) {
  return (
    <>
      <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...pulse, height: 30, width: 168, borderRadius: 9999 }} />
        <div style={{ ...pulse, height: 14, width: 220, borderRadius: 8, animationDelay: '60ms' }} />
      </div>
      <ViewTransition name={heroVtName('res', slug)} share="morph" default="none">
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
      </ViewTransition>
    </>
  );
}

async function ResourceDetailContent({ slug }: { slug: string }) {
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  const hasAccess = canAccess(mockCurrentUser.capability, resource.visibilite);
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

      <ViewTransition name={heroVtName('res', slug)} share="morph" default="none">
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

          <hr
            style={{
              border: 'none',
              borderTop: '1px solid var(--color-border-default)',
              margin: '28px 0',
            }}
          />

          {hasAccess ? (
            <div data-fb-label="Corps Notion · Page ressource">
              {resource.content.map((block, idx) => renderBlock(block, idx))}
            </div>
          ) : (
            <CapabilityLock
              title={`Contenu réservé aux membres ${resource.visibilite}`}
              description={`Cette ressource est accessible à partir de l'offre ${resource.visibilite}. Rejoins le programme pour la débloquer ainsi que toute la bibliothèque correspondante.`}
              ctaLabel="Découvrir les offres"
              ctaHref="/offres"
            />
          )}
        </div>
      </ViewTransition>

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
      <GradualBlurOverlay />
      <div className="nc-page-halo" style={{ minHeight: '100lvh' }}>
        <main style={{ position: 'relative', zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              {/* Le shell ne suspend pas (await params seulement) → la grille
                  loading.tsx parente ne s'affiche pas ; seul ce Suspense interne
                  pilote le skeleton, cible du morph puis du reveal. */}
              <Suspense fallback={<ResourceDetailSkeleton slug={slug} />}>
                <ResourceDetailContent slug={slug} />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
