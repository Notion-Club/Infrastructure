// Server-side data access for Ressources & Templates.
// Branchements: Notion API via `./notion.ts`. The Server Components consuming
// these functions (page index + detail pages) re-render via Next.js ISR
// (revalidate 60s on each fetch).

import {
  fetchResources,
  fetchTemplates,
  fetchResourceBySlug,
  fetchTemplateBySlug,
} from './notion';
import type { Resource, Template, ResourceItem } from '../types';

export async function getAllResourceItems(): Promise<ResourceItem[]> {
  const [resources, templates] = await Promise.all([fetchResources(), fetchTemplates()]);
  return [...resources, ...templates].sort(
    (a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime(),
  );
}

export async function getResourceBySlug(slug: string): Promise<Resource | null> {
  return fetchResourceBySlug(slug);
}

export async function getTemplateBySlug(slug: string): Promise<Template | null> {
  return fetchTemplateBySlug(slug);
}

// Phase 2: "ressources liées" — pas de propriété Relation sur les bases Notion
// actuelles. Pour cette PR, on renvoie systématiquement une liste vide ; la
// section "Ces ressources peuvent aussi t'intéresser" disparaît automatiquement
// dans `ResourcePageFooter` / `TemplatePageFooter` quand le tableau est vide.
export function getRelatedResources(): Resource[] {
  return [];
}
export function getRelatedTemplates(): Template[] {
  return [];
}
