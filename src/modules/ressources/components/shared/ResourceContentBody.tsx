// Corps détail d'une RESSOURCE : séparateur + blocs Notion, OU verrou d'accès.
//
// SOURCE UNIQUE partagée par l'overlay de morph et la vraie page détail → la
// logique d'accès et le rendu du corps ne peuvent plus diverger. Fonction pure
// (pas de hook, pas de dépendance serveur) → utilisable serveur ET client.
// L'accès (`hasAccess`) est calculé par l'appelant à partir des vraies
// capabilities Supabase (page serveur : getCurrentUserCapabilities ; overlay
// client : caps passées en prop) — jamais recalculé ici.

import { CapabilityLock } from './CapabilityLock';
import { NotionRenderer } from '@/shared/components/notion/NotionRenderer';
import type { Resource } from '../../types';

export function ResourceContentBody({ resource, hasAccess }: { resource: Resource; hasAccess: boolean }) {
  return (
    <>
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: '28px 0' }} />
      {hasAccess ? (
        // Garde contenu-vide : l'overlay de morph réutilise ce composant avec
        // un `resource` issu de la LISTE (content non chargé → []). On rend
        // alors un wrapper vide plutôt que le message « pas de corps » de
        // NotionRenderer — parité exacte avec l'ancien `[].map(renderBlock)`.
        resource.content.length > 0 ? (
          <NotionRenderer
            blocks={resource.content}
            label="Corps Notion · Page ressource"
          />
        ) : (
          <div data-fb-label="Corps Notion · Page ressource" />
        )
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
