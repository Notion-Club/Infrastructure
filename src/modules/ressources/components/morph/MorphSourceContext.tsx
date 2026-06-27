'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { ResourceItem } from '../../types';
import { ResourceMorphOverlay } from './ResourceMorphOverlay';

// Contrôleur du morph d'ouverture/fermeture des cartes de la grille (ressources
// ET templates). Plus AUCUNE navigation Next : la carte cliquée ouvre un overlay
// en portail, lu depuis les données DÉJÀ chargées (la grille porte tout le
// contenu). Zéro re-fetch, zéro `loading.tsx`, la grille ne se démonte jamais →
// fond statique, fermeture sans re-cascade.
export interface MorphSource {
  /** Donnée complète de la carte (Resource = contenu inclus, Template = embed/url). */
  item: ResourceItem;
  /** Géométrie de la carte au clic (point de départ du morph). */
  cardRect: DOMRect;
  /** Géométrie du titre de la carte (ancre du titre continu). */
  titleRect: DOMRect;
  /** Élément déclencheur (le lien de la carte) — pour restituer le focus à la fermeture (a11y). */
  triggerEl?: HTMLElement | null;
}

interface MorphCtx {
  open: (source: MorphSource) => void;
  source: MorphSource | null;
}

const MorphContext = createContext<MorphCtx | null>(null);

export function MorphSourceProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<MorphSource | null>(null);

  const open = useCallback((s: MorphSource) => setSource(s), []);
  // Démontage réel APRÈS l'animation de fermeture : l'overlay appelle onClose une
  // fois le morph de sortie terminé → la fermeture a le temps de jouer.
  const handleClosed = useCallback(() => setSource(null), []);

  return (
    <MorphContext.Provider value={{ open, source }}>
      {children}
      {source && (
        <ResourceMorphOverlay
          // Remonte un overlay NEUF par item → aucun résidu de l'animation
          // précédente (refs/anims repartent de zéro).
          key={source.item.slug}
          source={source}
          onClose={handleClosed}
        />
      )}
    </MorphContext.Provider>
  );
}

export function useMorph(): MorphCtx {
  const ctx = useContext(MorphContext);
  if (!ctx) throw new Error('useMorph doit être utilisé sous <MorphSourceProvider>');
  return ctx;
}
