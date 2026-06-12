import { notFound } from 'next/navigation';
import { GradualBlurOverlay } from '@/shared/components/GradualBlurOverlay';
import { getResourceBySlug, getRelatedResources } from '@/modules/ressources/lib/fetch';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceBreadcrumb } from '@/modules/ressources/components/shared/ResourceBreadcrumb';
import { ResourceBadge } from '@/modules/ressources/components/shared/ResourceBadge';
import { CapabilityLock } from '@/modules/ressources/components/shared/CapabilityLock';
import { ResourcePageFooter } from '@/modules/ressources/components/shared/ResourcePageFooter';
import { canAccess } from '@/modules/ressources/lib/access';
import { renderBlock, formatDate, encadreStyle } from '@/modules/ressources/components/shared/renderBlock';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Route directe (accès partagé / SEO / nouvel onglet). Le morph d'ouverture
// depuis la grille passe désormais par l'overlay FLIP client (ResourceOverlay) ;
// cette page est un rendu serveur complet, sans morph.
export default async function ResourceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  const hasAccess = canAccess(mockCurrentUser.capability, resource.visibilite);
  const relatedResources = getRelatedResources();

  return (
    <>
      <GradualBlurOverlay />
      <div className="nc-page-halo" style={{ minHeight: '100dvh' }}>
        <main style={{ position: 'relative', zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
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
