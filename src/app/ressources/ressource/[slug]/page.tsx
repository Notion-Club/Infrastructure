import { notFound } from 'next/navigation';
import { Topbar } from '@/shared/components/dashboard/Topbar';
import { MobileTopActions } from '@/shared/components/dashboard/mobile/MobileTopActions';
import { BottomNav } from '@/shared/components/dashboard/mobile/BottomNav';
import { getResourceBySlug, getRelatedResources } from '@/modules/ressources/lib/fetch';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceBreadcrumb } from '@/modules/ressources/components/shared/ResourceBreadcrumb';
import { ResourceBadge } from '@/modules/ressources/components/shared/ResourceBadge';
import { TellaEmbed } from '@/modules/ressources/components/shared/TellaEmbed';
import { CapabilityLock } from '@/modules/ressources/components/shared/CapabilityLock';
import { ResourcePageFooter } from '@/modules/ressources/components/shared/ResourcePageFooter';
import { canAccess } from '@/modules/ressources/lib/access';
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
              {item}
            </li>
          ))}
        </ul>
      );

    case 'tella_embed':
      return (
        <div key={idx} style={{ margin: '24px 0' }}>
          <TellaEmbed url={block.url} />
        </div>
      );

    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={idx}
          src={block.url}
          alt={block.alt ?? ''}
          style={{
            width: '100%',
            borderRadius: 12,
            margin: '24px 0',
          }}
        />
      );

    default:
      return null;
  }
}

export default async function ResourceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const resource = getResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const hasAccess = canAccess(mockCurrentUser.capability, resource!.visibilite);
  const relatedResources = getRelatedResources(resource.relatedSlugs ?? []);

  return (
    <>
      <Topbar />
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>
      <div className="nc-page-halo" style={{ minHeight: '100dvh' }}>
        <main style={{ position: 'relative', zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              {/* Breadcrumb */}
              <div style={{ marginBottom: 32 }}>
                <ResourceBreadcrumb
                  items={[
                    { label: resource.type, href: `/ressources?type=${encodeURIComponent(resource.type)}` },
                    { label: resource.titre },
                  ]}
                />
              </div>

              {/* Header card */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 20,
                  padding: '32px',
                  boxShadow: 'var(--nc-shadow-3)',
                  marginBottom: 32,
                  viewTransitionName: `card-${resource.slug}`,
                }}
              >
                <h1
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <ResourceBadge variant="ressource" label="Ressource" />
                  <ResourceBadge variant="formation" label={resource.formation} />
                  <ResourceBadge variant="type" label={resource.type} />
                </div>
              </div>

              {/* Content */}
              {hasAccess ? (
                <div>
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

              {/* Footer unifié : bouton vu + ressources liées (conditionnel) */}
              <ResourcePageFooter
                relatedResources={relatedResources}
                currentCapability={mockCurrentUser.capability}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
