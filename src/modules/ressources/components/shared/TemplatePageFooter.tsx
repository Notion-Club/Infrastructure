import type { Template, UserCapability } from '../../types';
import { TemplateCard } from '../TemplateCard';

const NOTION_LOGO = 'https://res.cloudinary.com/dceobxyts/image/upload/v1776790487/Logo_Notion_fgou5g.png';

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
      data-fb-label="Pied de page template · Page template"
      style={{
        marginTop: 48,
        background: 'var(--color-surface-card)',
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
          data-fb-label="Bouton Dupliquer dans Notion · Pied de page template"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '18px 24px',
            background: 'var(--nc-btn-dark-bg)',
            color: 'var(--nc-btn-dark-text)',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            borderBottom: hasRelated ? '1px solid var(--color-border-default)' : 'none',
            transition: 'opacity 150ms ease',
          }}
          className="hover:opacity-85"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={NOTION_LOGO} alt="" width={18} height={18} style={{ borderRadius: 3 }} />
          Dupliquer dans Notion ✓
        </a>
      ) : (
        <div
          data-fb-label="Cadenas accès · Pied de page template"
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
            data-fb-label="Grille templates liés · Pied de page template"
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
