'use server';

// Server Action — charge le CORPS Notion normalisé d'une ressource pour
// l'OVERLAY de morph (composant client, données de la carte = sans body).
//
// L'overlay s'ouvre instantanément avec le header (titre/desc/badges déjà en
// mémoire) puis appelle cette action pour récupérer le corps et l'afficher,
// sans quitter la grille (aucune navigation). Même source que la vraie page
// détail (`getResourceBySlug`) → rendu identique.
//
// ⚠️ Gating server-side : le contenu d'une ressource verrouillée n'est JAMAIS
// renvoyé au client. Si l'accès n'est pas accordé, on renvoie [] (l'overlay
// affiche alors le CapabilityLock via ResourceContentBody).

import { getResourceBySlug } from '../lib/fetch';
import { getCurrentUserCapabilities } from '@/shared/lib/auth/capabilities';
import { hasAccessToVisibility } from '@/shared/types/capabilities';
import type { NotionBlock } from '../types';

export async function getResourceBody(slug: string): Promise<NotionBlock[]> {
  const resource = await getResourceBySlug(slug);
  if (!resource) return [];
  const caps = await getCurrentUserCapabilities();
  if (!hasAccessToVisibility(resource.visibilite, caps)) return [];
  return resource.content;
}
