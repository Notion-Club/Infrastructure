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

export { getAllResourceItems, getResourceBySlug, getTemplateBySlug } from './lib/fetch';

export { ResourceCard } from './components/ResourceCard';
export { TemplateCard } from './components/TemplateCard';
export { ResourcesGrid } from './components/ResourcesGrid';
export { ResourceBadge } from './components/shared/ResourceBadge';
export { ResourceBreadcrumb } from './components/shared/ResourceBreadcrumb';
export { TellaEmbed } from './components/shared/TellaEmbed';
export { CapabilityLock } from './components/shared/CapabilityLock';
