'use client';

import { createContext, useContext, useRef, type MutableRefObject, type ReactNode } from 'react';
import type { ResourceItem } from '../../types';

// Géométrie + données de la carte cliquée, posées AVANT la navigation intercoptée
// et lues par l'overlay de morph. Ref (pas de state) → écriture synchrone au clic,
// zéro re-render de la grille.
export interface MorphSource {
  resource: ResourceItem;
  cardRect: DOMRect;
  titleRect: DOMRect;
}

const MorphRefContext = createContext<MutableRefObject<MorphSource | null> | null>(null);

export function MorphSourceProvider({ children }: { children: ReactNode }) {
  const ref = useRef<MorphSource | null>(null);
  return <MorphRefContext.Provider value={ref}>{children}</MorphRefContext.Provider>;
}

export function useMorphSourceRef(): MutableRefObject<MorphSource | null> {
  const ctx = useContext(MorphRefContext);
  if (!ctx) throw new Error('useMorphSourceRef doit être utilisé sous <MorphSourceProvider>');
  return ctx;
}
