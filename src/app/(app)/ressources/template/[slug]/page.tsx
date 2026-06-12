import { notFound } from 'next/navigation';
import { GradualBlurOverlay } from '@/shared/components/GradualBlurOverlay';
import { getTemplateBySlug, getRelatedTemplates } from '@/modules/ressources/lib/fetch';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceBreadcrumb } from '@/modules/ressources/components/shared/ResourceBreadcrumb';
import { ResourceBadge } from '@/modules/ressources/components/shared/ResourceBadge';
import { TellaEmbed } from '@/modules/ressources/components/shared/TellaEmbed';
import { TemplatePageFooter } from '@/modules/ressources/components/shared/TemplatePageFooter';
import { canAccess } from '@/modules/ressources/lib/access';
import { formatDate, encadreStyle } from '@/modules/ressources/components/shared/renderBlock';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Route directe (partage / SEO / nouvel onglet). Le morph passe par l'overlay
// FLIP client depuis la grille ; ici, rendu serveur complet sans morph.
export default async function TemplateDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);

  if (!template) {
    notFound();
  }

  const hasAccess = canAccess(mockCurrentUser.capability, template.visibilite);
  const relatedTemplates = getRelatedTemplates();

  return (
    <>
      <GradualBlurOverlay />
      <div className="nc-page-halo" style={{ minHeight: '100dvh' }}>
        <main style={{ position: 'relative', zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <div data-fb-label="Fil d'ariane · Page template" style={{ marginBottom: 32 }}>
                <ResourceBreadcrumb
                  items={[
                    { label: 'Templates', href: '/ressources?cat=template' },
                    { label: template.titre },
                  ]}
                />
              </div>

              <div data-fb-label="Encadré contenu · Page template" style={encadreStyle}>
                <h1
                  data-fb-label="Titre · Page template"
                  style={{
                    fontSize: 'clamp(36px, 5vw, 52px)',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 16px',
                    lineHeight: 1.1,
                  }}
                >
                  {template.titre}
                </h1>
                <p
                  style={{
                    fontSize: 16,
                    color: 'var(--color-text-secondary)',
                    margin: '0 0 16px',
                    lineHeight: 1.6,
                  }}
                >
                  {template.description}
                </p>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                    marginBottom: 16,
                  }}
                >
                  {formatDate(template.dateCreation)}
                </div>
                <div data-fb-label="Badges méta · Page template" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: template.urlTella ? 24 : 0 }}>
                  <ResourceBadge variant="template" label="Template" />
                  <ResourceBadge variant="type" label={template.type} />
                </div>
                {template.urlTella && (
                  <div data-fb-label="Embed vidéo Tella · Page template">
                    <TellaEmbed url={template.urlTella} />
                  </div>
                )}
              </div>

              <TemplatePageFooter
                template={template}
                hasAccess={hasAccess}
                relatedTemplates={relatedTemplates}
                currentCapability={mockCurrentUser.capability}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
