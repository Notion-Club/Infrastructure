export type {
  ResourceCategory,
  ResourceFormation,
  ResourceMetierType,
  TemplateType,
  UserCapability,
  ContentBlock,
  Resource,
  Template,
  ResourceItem,
} from './types';

// API legacy (fetch direct Notion sans cache ni gating server-side).
// À retirer une fois que Théo a basculé les pages sur les nouvelles queries
// serveur (resolveResourceAccess + getAllResourceItems depuis ./server).
export { getAllResourceItems, getResourceBySlug, getTemplateBySlug } from './lib/fetch';

// API serveur recommandée : cache Supabase + gating server-side du content.
// resolveResourceAccess remplace getResourceBySlug + canAccess(mockCurrentUser).
export {
  getAllResourceItems as getAllResourceItemsCached,
  resolveResourceAccess,
} from './server/queries';

export { ResourceCard } from './components/ResourceCard';
export { TemplateCard } from './components/TemplateCard';
export { ResourcesGrid } from './components/ResourcesGrid';
export { ResourceBadge } from './components/shared/ResourceBadge';
export { ResourceBreadcrumb } from './components/shared/ResourceBreadcrumb';
export { TellaEmbed } from './components/shared/TellaEmbed';
export { CapabilityLock } from './components/shared/CapabilityLock';
