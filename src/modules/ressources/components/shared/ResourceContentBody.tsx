// Corps détail d'une RESSOURCE : séparateur + blocs Notion, OU verrou d'accès.
//
// SOURCE UNIQUE partagée par l'overlay de morph et la vraie page détail → la
// logique d'accès et le rendu du corps ne peuvent plus diverger. Fonction pure
// (pas de hook, pas de dépendance serveur) → utilisable serveur ET client.

import { canAccess } from '../../lib/access';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import { CapabilityLock } from './CapabilityLock';
import { renderBlock } from './renderBlock';
import type { Resource } from '../../types';

export function ResourceContentBody({ resource }: { resource: Resource }) {
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
