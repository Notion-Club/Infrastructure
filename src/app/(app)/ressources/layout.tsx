import type { ReactNode } from 'react';
import { MorphSourceProvider } from '@/modules/ressources/components/morph/MorphSourceContext';

// Layout /Ressources : fournit le contrôleur de morph. La carte cliquée ouvre un
// overlay en portail EN PLACE (donnée déjà chargée, aucune navigation) → la
// grille ne se démonte jamais. Plus de slot parallèle `@modal` ni de route
// intercoptée (supprimés : ils re-fetchaient et déclenchaient loading.tsx).
export default function RessourcesLayout({ children }: { children: ReactNode }) {
  return <MorphSourceProvider>{children}</MorphSourceProvider>;
}
