import { mockResources, mockTemplates, mockResourceItems } from './mock-data';
import type { Resource, Template, ResourceItem } from '../types';

export function getAllResourceItems(): ResourceItem[] {
  return mockResourceItems;
}

export function getResourceBySlug(slug: string): Resource | undefined {
  return mockResources.find((r) => r.slug === slug);
}

export function getTemplateBySlug(slug: string): Template | undefined {
  return mockTemplates.find((t) => t.slug === slug);
}

// TODO(backend): remplacer par une requête Supabase qui suit la relation
// de propriété Notion (self-referencing relation sur la table resources).
// La colonne Supabase attendue : resources.related_resource_ids uuid[].
export function getRelatedResources(slugs: string[]): Resource[] {
  if (!slugs.length) return [];
  return mockResources.filter((r) => slugs.includes(r.slug));
}

// TODO(backend): idem pour les templates — table templates.related_template_ids uuid[].
export function getRelatedTemplates(slugs: string[]): Template[] {
  if (!slugs.length) return [];
  return mockTemplates.filter((t) => slugs.includes(t.slug));
}
