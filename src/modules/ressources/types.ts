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

export type ListItem = { text: string; children?: ContentBlock[] };

export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'tella_embed'; url: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'list'; items: ListItem[] }
  | { type: 'callout'; icon: string | null; text: string; children: ContentBlock[] }
  | { type: 'quote'; text: string; children: ContentBlock[] }
  | { type: 'code'; language: string; text: string }
  | { type: 'table'; rows: string[][] };

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
  content: ContentBlock[];
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
