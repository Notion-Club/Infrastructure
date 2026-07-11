import type { ReactNode } from 'react';
import { MorphSourceProvider } from '@/modules/ressources/components/morph/MorphSourceContext';
import { getCurrentUserCapabilities } from '@/shared/lib/auth/capabilities';

// Layout /Ressources : fournit le contrôleur de morph. La carte cliquée ouvre un
// overlay en portail EN PLACE (donnée déjà chargée, aucune navigation) → la
// grille ne se démonte jamais. Plus de slot parallèle `@modal` ni de route
// intercoptée (supprimés : ils re-fetchaient et déclenchaient loading.tsx).
//
// Les vraies capabilities du user (Supabase) sont résolues ici, côté serveur, et
// passées à l'overlay client pour le gating (UX lock + skip carrousel). Le gating
// anti-fuite du contenu reste enforced côté serveur dans getResourceBody.
export default async function RessourcesLayout({ children }: { children: ReactNode }) {
  const caps = await getCurrentUserCapabilities();
  return <MorphSourceProvider caps={caps}>{children}</MorphSourceProvider>;
}
