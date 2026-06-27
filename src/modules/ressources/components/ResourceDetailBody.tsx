// Corps de la page détail (RSC, async) — réutilisé par la page PLEINE et par
// l'OVERLAY de morph (route intercoptée). PAS de ViewTransition : la transition
// est désormais portée par le morph WAAPI. Le header (titre/desc/badges/date)
// est rendu côté overlay depuis les données de la carte (contexte) ; ici on
// rend uniquement le CORPS Notion (+ verrou d'accès + footer « ressources liées »).

import { notFound } from 'next/navigation';
import { getResourceBySlug, getRelatedResources } from '../lib/fetch';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { CapabilityLock } from './shared/CapabilityLock';
import { ResourcePageFooter } from './shared/ResourcePageFooter';
import { TellaEmbed } from './shared/TellaEmbed';
import { canAccess } from '../lib/access';
import type { ContentBlock } from '../types';

export function renderBlock(block: ContentBlock, idx: number) {
  switch (block.type) {
    case 'heading':
      if (block.level === 2) {
        return (
          <h2 key={idx} style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', margin: '32px 0 12px', lineHeight: 1.3 }}>
            {block.text}
          </h2>
        );
      }
      return (
        <h3 key={idx} style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', margin: '24px 0 10px', lineHeight: 1.4 }}>
          {block.text}
        </h3>
      );
    case 'paragraph':
      return (
        <p key={idx} style={{ fontSize: 15, color: 'var(--color-text-secondary)', margin: '0 0 16px', lineHeight: 1.7 }}>
          {block.text}
        </p>
      );
    case 'list':
      return (
        <ul key={idx} style={{ margin: '0 0 16px', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {item.text}
              {item.children && item.children.length > 0 && (
                <div style={{ marginTop: 6 }}>{item.children.map((child, j) => renderBlock(child, j))}</div>
              )}
            </li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <div key={idx} style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-default)', borderRadius: 12, padding: '14px 16px', margin: '0 0 12px', display: 'flex', gap: 10 }}>
          {block.icon && <span style={{ flexShrink: 0, fontSize: 16, lineHeight: '24px' }}>{block.icon}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            {block.text && <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', margin: '0 0 8px', lineHeight: 1.7 }}>{block.text}</p>}
            {block.children.map((child, i) => renderBlock(child, i))}
          </div>
        </div>
      );
    case 'quote':
      return (
        <blockquote key={idx} style={{ borderLeft: '3px solid var(--color-border-default)', paddingLeft: 16, margin: '0 0 16px' }}>
          {block.text && <p style={{ fontSize: 15, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.7, fontStyle: 'italic' }}>{block.text}</p>}
          {block.children.length > 0 && <div>{block.children.map((child, i) => renderBlock(child, i))}</div>}
        </blockquote>
      );
    case 'code':
      return (
        <pre key={idx} style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-default)', borderRadius: 8, padding: '12px 16px', margin: '0 0 16px', overflowX: 'auto' }}>
          <code style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'monospace', lineHeight: 1.6 }}>{block.text}</code>
        </pre>
      );
    case 'tella_embed':
      return (
        <div key={idx} style={{ margin: '24px 0' }}>
          <TellaEmbed url={block.url} />
        </div>
      );
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={idx} src={block.url} alt={block.alt ?? ''} style={{ width: '100%', borderRadius: 12, margin: '24px 0' }} />;
    default: {
      const b = block as { type: string };
      console.warn(`[ressources/renderBlock] type ContentBlock non rendu : "${b.type}"`);
      return null;
    }
  }
}

// Corps réel : verrou d'accès OU blocs Notion. Rendu sous le header (séparateur
// inclus). Suspendu côté overlay/page pendant le fetch Notion.
export async function ResourceDetailBody({ slug }: { slug: string }) {
  const resource = await getResourceBySlug(slug);
  if (!resource) notFound();

  const hasAccess = canAccess(mockCurrentUser.capability, resource.visibilite);

  return (
    <>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: '28px 0' }} />
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
    </>
  );
}

// Footer « ressources liées » — rendu sous l'encadré (hors morph).
export function ResourceDetailFooter() {
  const relatedResources = getRelatedResources();
  return <ResourcePageFooter relatedResources={relatedResources} currentCapability={mockCurrentUser.capability} />;
}
