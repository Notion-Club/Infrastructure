export type ResourceCategory = 'resource' | 'template';
export type ResourceFormation = 'Notion Business' | 'Notion Architecte';
export type ResourceMetierType =
  | 'Relation Client'
  | 'Production'
  | 'Acquisition'
  | 'Sales'
  | 'Business'
  | 'Rediffusion de Live';
export type TemplateType = 'Pour les Consultants Notion' | 'Système Généraliste';

export type UserCapability = 'challenge' | 'formation' | 'accompagnement';
export type ResourceVisibility = 'Publique' | 'Challenge Gratuit' | 'Formation' | 'Accompagnement';

// Le corps des ressources est désormais l'arbre normalisé du routeur Notion
// unifié (rich text + annotations complètes, tous types de blocs supportés),
// rendu par <NotionRenderer />. Remplace l'ancien `ContentBlock` lossy.
import type { NotionBlock } from '@/shared/lib/notion/router';
export type { NotionBlock };

export interface Resource {
  category: 'resource';
  /** ID Notion 32 chars sans tirets — sert d'URL slug. */
  slug: string;
  titre: string;
  description: string;
  formation: ResourceFormation[];
  type: ResourceMetierType[];
  visibilite: ResourceVisibility;
  dateCreation: string;
  content: NotionBlock[];
}

export interface Template {
  category: 'template';
  slug: string;
  titre: string;
  description: string;
  type: TemplateType;
  visibilite: ResourceVisibility;
  urlNotionPublicPage: string;
  urlTella?: string;
  dateCreation: string;
}

export type ResourceItem = Resource | Template;
