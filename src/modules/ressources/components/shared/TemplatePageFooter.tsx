import type { Template, UserCapability } from '../../types';
import { TemplateCard } from '../TemplateCard';

const NotionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <rect width="100" height="100" rx="14" fill="white" />
    <path d="M24 20h52v8L48 72H76v8H24v-8l28-44H24V20z" fill="black" />
  </svg>
);

interface TemplatePageFooterProps {
  template: Template;
  hasAccess: boolean;
  relatedTemplates: Template[];
  currentCapability: UserCapability;
}

export function TemplatePageFooter({
  template,
  hasAccess,
  relatedTemplates,
  currentCapability,
}: TemplatePageFooterProps) {
  const hasRelated = relatedTemplates.length > 0;

  return (
    <div
      style={{
        marginTop: 48,
        background: '#ffffff',
        border: '1px solid var(--color-border-default)',
        borderRadius: 20,
        boxShadow: 'var(--nc-shadow-3)',
        overflow: 'hidden',
      }}
    >
      {/* Bouton pleine largeur */}
      {hasAccess ? (
        <a
          href={template.urlNotionPublicPage}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '18px 24px',
            background: '#000000',
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            borderBottom: hasRelated ? '1px solid rgba(255,255,255,0.1)' : 'none',
            transition: 'opacity 150ms ease',
          }}
          className="hover:opacity-85"
        >
          <NotionIcon />
          Dupliquer dans Notion ✓
        </a>
      ) : (
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '18px 24px',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-muted)',
            fontSize: 15,
            fontWeight: 600,
            borderBottom: hasRelated ? '1px solid var(--color-border-default)' : 'none',
          }}
        >
          🔒 Contenu réservé aux membres {template.visibilite}
        </div>
      )}

      {/* Templates liés — uniquement si la liste n'est pas vide */}
      {hasRelated && (
        <div style={{ padding: '32px 24px' }}>
          <h2
            style={{
              fontSize: 'clamp(22px, 3.5vw, 28px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--color-text-primary)',
              margin: '0 0 24px',
              textAlign: 'center',
              lineHeight: 1.25,
            }}
          >
            Ces templates peuvent aussi t&apos;intéresser
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {relatedTemplates.map((t) => (
              <TemplateCard key={t.slug} template={t} currentCapability={currentCapability} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
