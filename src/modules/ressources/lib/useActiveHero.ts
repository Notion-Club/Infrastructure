'use client';

import { useSyncExternalStore } from 'react';

/**
 * Store minimal du slug « héros » : la carte de la grille dont l'encadré morphe
 * vers la page détail (et inversement au retour). On n'attribue le
 * `view-transition-name` partagé qu'à CETTE carte pour que la grille reste
 * unique — prérequis de l'API View Transitions (un nom = un seul élément).
 *
 * Singleton de module : la valeur survit au démontage de la grille (navigation
 * SPA), si bien qu'au retour sur `/ressources` la bonne carte se ré-attribue le
 * nom dès son premier rendu → le morph de fermeture atterrit au bon endroit.
 */
let activeSlug: string | null = null;
const listeners = new Set<() => void>();

export function setActiveHero(slug: string | null): void {
  if (activeSlug === slug) return;
  activeSlug = slug;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Slug actuellement « ouvert » (ou en cours d'ouverture), ou `null`. */
export function useActiveHero(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => activeSlug,
    () => null, // SSR : aucune carte héros au premier rendu serveur.
  );
}
