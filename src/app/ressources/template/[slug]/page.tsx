import { notFound } from 'next/navigation';
import { Topbar } from '@/shared/components/dashboard/Topbar';
import { MobileTopActions } from '@/shared/components/dashboard/mobile/MobileTopActions';
import { BottomNav } from '@/shared/components/dashboard/mobile/BottomNav';
import { getTemplateBySlug } from '@/modules/ressources/lib/fetch';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceBreadcrumb } from '@/modules/ressources/components/shared/ResourceBreadcrumb';
import { ResourceBadge } from '@/modules/ressources/components/shared/ResourceBadge';
import { TellaEmbed } from '@/modules/ressources/components/shared/TellaEmbed';
import { CapabilityLock } from '@/modules/ressources/components/shared/CapabilityLock';
import { canAccess } from '@/modules/ressources/lib/access';
import { DuplicateButton } from './DuplicateButton';

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
  const template = getTemplateBySlug(slug);

  if (!template) {
    notFound();
  }

  const hasAccess = canAccess(mockCurrentUser.capability, template.visibilite);

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
                    { label: 'Templates' },
                    { label: template.titre },
                  ]}
                />
              </div>

              {/* Header */}
              <header style={{ marginBottom: 32, viewTransitionName: `card-${template.slug}` }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <ResourceBadge variant="template" label="Template" />
                  <ResourceBadge variant="type" label={template.type} />
                </div>
              </header>

              {/* Tella video preview */}
              {template.urlTella && (
                <div style={{ marginBottom: 32 }}>
                  <TellaEmbed url={template.urlTella} />
                </div>
              )}

              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid var(--color-border-default)',
                  margin: '0 0 32px',
                }}
              />

              {/* CTA or lock */}
              {hasAccess ? (
                <DuplicateButton url={template.urlNotionPublicPage} />
              ) : (
                <CapabilityLock
                  title={`Template réservé aux membres ${template.visibilite}`}
                  description={`Ce template est accessible à partir de l'offre ${template.visibilite}. Rejoins le programme pour le dupliquer dans ton espace Notion.`}
                  ctaLabel="Découvrir les offres"
                  ctaHref="/offres"
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
