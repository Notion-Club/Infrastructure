'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ResourceItem } from '../../types';
import type { UserCapabilities } from '@/shared/types/capabilities';
import { ResourceMorphOverlay } from './ResourceMorphOverlay';

// Contrôleur du morph d'ouverture/fermeture des cartes de la grille (ressources
// ET templates). Plus AUCUNE navigation Next : la carte cliquée ouvre un overlay
// en portail, lu depuis les données DÉJÀ chargées (la grille porte tout le
// contenu). Zéro re-fetch, zéro `loading.tsx`, la grille ne se démonte jamais →
// fond statique, fermeture sans re-cascade.
//
// NAVIGATION AU SWIPE : l'overlay ne se contente plus d'afficher UN item — il
// peut naviguer vers le voisin ±1 (carrousel « Tinder »). Pour ça il lui faut la
// LISTE ordonnée visible (celle filtrée/cherchée par la grille) + l'index de
// départ. La grille/le lab l'enregistrent via `registerItems` ; à l'ouverture on
// FIGE un snapshot de cette liste (elle ne peut plus bouger : l'overlay couvre la
// grille) et on calcule l'index par slug.
export interface MorphSource {
  /** Donnée complète de la carte (Resource = contenu inclus, Template = embed/url). */
  item: ResourceItem;
  /** Géométrie de la carte au clic (point de départ du morph). */
  cardRect: DOMRect;
  /** Géométrie du titre de la carte (ancre du titre continu). */
  titleRect: DOMRect;
  /** Élément déclencheur (le lien de la carte) — pour restituer le focus à la fermeture (a11y). */
  triggerEl?: HTMLElement | null;
  /** Ouverture au CLAVIER (Entrée/Espace) ? Sinon (souris/tactile) on ne restitue
   *  pas le focus à la fermeture → pas d'encadré bleu de sélection iOS. */
  viaKeyboard?: boolean;
}

/** Snapshot figé passé à l'overlay : la liste ordonnée visible + l'index de départ.
 *  Gelé à l'ouverture (la grille est couverte → la liste ne peut plus changer). */
interface MorphSession {
  source: MorphSource;
  items: ResourceItem[];
  index: number;
}

interface MorphCtx {
  open: (source: MorphSource) => void;
  /** La grille (ou le lab) publie sa liste visible ordonnée → base du swipe ±1. */
  registerItems: (items: ResourceItem[]) => void;
  session: MorphSession | null;
}

const MorphContext = createContext<MorphCtx | null>(null);

export function MorphSourceProvider({
  children,
  caps,
}: {
  children: ReactNode;
  caps: UserCapabilities;
}) {
  const [session, setSession] = useState<MorphSession | null>(null);
  // Liste visible courante — ref (pas d'état) : la republier ne doit JAMAIS
  // re-render le provider ni remonter l'overlay.
  const itemsRef = useRef<ResourceItem[]>([]);

  const registerItems = useCallback((items: ResourceItem[]) => {
    itemsRef.current = items;
  }, []);

  const open = useCallback((s: MorphSource) => {
    // Fige un snapshot de la liste visible au moment du clic. Si l'item cliqué
    // n'y est pas (lab sans enregistrement, garde), on retombe sur une liste à un
    // seul élément → swipe inerte, ouverture/fermeture normales.
    const list = itemsRef.current;
    const idx = list.findIndex((i) => i.slug === s.item.slug);
    if (idx === -1) {
      setSession({ source: s, items: [s.item], index: 0 });
    } else {
      setSession({ source: s, items: list.slice(), index: idx });
    }
  }, []);

  // Démontage réel APRÈS l'animation de fermeture : l'overlay appelle onClose une
  // fois le morph de sortie terminé → la fermeture a le temps de jouer.
  const handleClosed = useCallback(() => setSession(null), []);

  return (
    <MorphContext.Provider value={{ open, registerItems, session }}>
      {children}
      {session && (
        <ResourceMorphOverlay
          // Remonte un overlay NEUF par OUVERTURE (clé = slug cliqué) → aucun
          // résidu de l'animation précédente. La navigation au swipe se fait
          // ENSUITE dans l'overlay monté (index interne), sans remontage.
          key={session.source.item.slug}
          source={session.source}
          items={session.items}
          initialIndex={session.index}
          caps={caps}
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
