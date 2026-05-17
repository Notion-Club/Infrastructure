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
