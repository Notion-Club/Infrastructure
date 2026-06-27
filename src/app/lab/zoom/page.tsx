import { notFound } from 'next/navigation';
import { getAllResourceItems } from '@/modules/ressources/lib/fetch';
import type { Resource } from '@/modules/ressources/types';
import { ZoomLab } from './ZoomLab';
import { LAB_RESOURCES, type LabResource } from './mock';

// Route lab DEV-ONLY — prototype de la zoom-transition /Ressources.
// Gated hors production : aucune surface de régression côté prod.
//
// PLACEMENT TEMPORAIRE : la route vit AU NIVEAU RACINE (hors du groupe `(app)`)
// pour rester accessible SANS login le temps de valider les previews.
// → Après validation, remettre sous `src/app/(app)/lab/zoom` (auth réelle).

// CONDITIONS RÉELLES : on charge les vraies ressources Notion via le data-layer
// EXISTANT du module (`getAllResourceItems` → `lib/notion`, ISR 60s). Fallback
// sur les mocks si le token n'est pas dispo / DB injoignable → le lab ne casse
// jamais.
async function getLabResources(): Promise<{ items: LabResource[]; source: 'notion' | 'mock' }> {
  try {
    const all = await getAllResourceItems();
    const resources = all.filter((i): i is Resource => i.category === 'resource');
    if (resources.length === 0) return { items: LAB_RESOURCES, source: 'mock' };
    return {
      items: resources.map((r) => ({
        slug: r.slug,
        titre: r.titre,
        description: r.description || '',
        formation: r.formation[0] ?? '',
        type: r.type[0] ?? '',
        dateCreation: r.dateCreation,
      })),
      source: 'notion',
    };
  } catch {
    return { items: LAB_RESOURCES, source: 'mock' };
  }
}

export default async function ZoomLabPage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }

  const { items, source } = await getLabResources();

  return (
    <div className="nc-page-halo" style={{ minHeight: '100lvh' }}>
      <ZoomLab resources={items} source={source} />
    </div>
  );
}
