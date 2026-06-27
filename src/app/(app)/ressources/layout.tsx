import type { ReactNode } from 'react';
import { MorphSourceProvider } from '@/modules/ressources/components/morph/MorphSourceContext';

// Layout /Ressources : fournit le contexte de morph (rect/resource de la carte
// cliquée) ET le slot parallèle `@modal` qui accueille la page détail
// INTERCOPTÉE (overlay morphé au-dessus de la grille restée montée).
export default function RessourcesLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <MorphSourceProvider>
      {children}
      {modal}
    </MorphSourceProvider>
  );
}
