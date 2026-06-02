import { notFound } from 'next/navigation';
import { GradualBlurOverlay } from '@/shared/components/GradualBlurOverlay';
import { getTemplateBySlug, getRelatedTemplates } from '@/modules/ressources/lib/fetch';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceBreadcrumb } from '@/modules/ressources/components/shared/ResourceBreadcrumb';
import { ResourceBadge } from '@/modules/ressources/components/shared/ResourceBadge';
import { TellaEmbed } from '@/modules/ressources/components/shared/TellaEmbed';
import { TemplatePageFooter } from '@/modules/ressources/components/shared/TemplatePageFooter';
import { canAccess } from '@/modules/ressources/lib/access';

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
              {/* Breadcrumb */}
              <div style={{ marginBottom: 32 }}>
                <ResourceBreadcrumb
                  items={[
                    { label: 'Templates', href: '/ressources?cat=template' },
                    { label: template.titre },
                  ]}
                />
              </div>

              {/* Header card — title, description, badges, video */}
              <div
                style={{
                  background: 'var(--color-surface-card)',
                  borderRadius: 20,
                  padding: '32px',
                  boxShadow: 'var(--nc-shadow-3)',
                  marginBottom: 32,
                  viewTransitionName: `card-${template.slug}`,
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: template.urlTella ? 24 : 0 }}>
                  <ResourceBadge variant="template" label="Template" />
                  <ResourceBadge variant="type" label={template.type} />
                </div>
                {template.urlTella && <TellaEmbed url={template.urlTella} />}
              </div>

              {/* Footer unifié : bouton dupliquer + templates liés (conditionnel) */}
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
