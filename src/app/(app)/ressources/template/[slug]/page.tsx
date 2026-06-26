import { Suspense, ViewTransition } from 'react';
import { notFound } from 'next/navigation';
import { getTemplateBySlug, getRelatedTemplates } from '@/modules/ressources/lib/fetch';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { ResourceBreadcrumb } from '@/modules/ressources/components/shared/ResourceBreadcrumb';
import { ResourceBadge } from '@/modules/ressources/components/shared/ResourceBadge';
import { TellaEmbed } from '@/modules/ressources/components/shared/TellaEmbed';
import { TemplatePageFooter } from '@/modules/ressources/components/shared/TemplatePageFooter';
import { canAccess } from '@/modules/ressources/lib/access';
import { heroVtName } from '@/modules/ressources/lib/heroTransition';

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

function TemplateDetailSkeleton({ slug }: { slug: string }) {
  return (
    <>
      <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...pulse, height: 30, width: 168, borderRadius: 9999 }} />
        <div style={{ ...pulse, height: 14, width: 200, borderRadius: 8, animationDelay: '60ms' }} />
      </div>
      <ViewTransition name={heroVtName('tpl', slug)} share="morph" default="none">
        <div style={{ ...encadreStyle, minHeight: 420 }}>
          <div style={{ ...pulse, height: 46, width: '68%', borderRadius: 'var(--nc-radius-sm)' }} />
          <div style={{ ...pulse, height: 16, width: '92%', marginTop: 20, borderRadius: 8, animationDelay: '60ms' }} />
          <div style={{ ...pulse, height: 16, width: '54%', marginTop: 10, borderRadius: 8, animationDelay: '100ms' }} />
          <div style={{ ...pulse, height: 13, width: 120, marginTop: 20, borderRadius: 8, animationDelay: '140ms' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {[100, 92].map((w, i) => (
              <div key={w} style={{ ...pulse, height: 24, width: w, borderRadius: 9999, animationDelay: `${160 + i * 40}ms` }} />
            ))}
          </div>
          <div style={{ ...pulse, marginTop: 24, width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--nc-radius-sm)', animationDelay: '220ms' }} />
        </div>
      </ViewTransition>
    </>
  );
}

async function TemplateDetailContent({ slug }: { slug: string }) {
  const template = await getTemplateBySlug(slug);

  if (!template) {
    notFound();
  }

  const hasAccess = canAccess(mockCurrentUser.capability, template.visibilite);
  const relatedTemplates = getRelatedTemplates();

  return (
    <>
      <div data-fb-label="Fil d'ariane · Page template" style={{ marginBottom: 32 }}>
        <ResourceBreadcrumb
          items={[
            { label: 'Templates', href: '/ressources?cat=template' },
            { label: template.titre },
          ]}
        />
      </div>

      <ViewTransition name={heroVtName('tpl', slug)} share="morph" default="none">
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
      </ViewTransition>

      <TemplatePageFooter
        template={template}
        hasAccess={hasAccess}
        relatedTemplates={relatedTemplates}
        currentCapability={mockCurrentUser.capability}
      />
    </>
  );
}

export default async function TemplateDetailPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <>
      {/* Pas de `GradualBlurOverlay` (cf. docs/pwa/safari-web-pwa-integration.md) :
          aligné sur Settings/Formation, contenu derrière la BottomNav translucide. */}
      <div className="nc-page-halo" style={{ minHeight: '100lvh' }}>
        <main style={{ position: 'relative', zIndex: 1 }}>
          <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <Suspense fallback={<TemplateDetailSkeleton slug={slug} />}>
                <TemplateDetailContent slug={slug} />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
