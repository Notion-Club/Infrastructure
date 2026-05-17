export type ResourceCategory = 'resource' | 'template';
export type ResourceFormation = 'Notion Business' | 'Notion Architecte';
export type ResourceMetierType = 'Relation Client' | 'Production' | 'Acquisition' | 'Sales' | 'Business';
export type TemplateType = 'Pour les consultants Notion' | 'Système Généraliste';

export type UserCapability = 'challenge' | 'formation' | 'accompagnement';
export type ResourceVisibility = 'Challenge Gratuit' | 'Formation' | 'Accompagnement';

export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'tella_embed'; url: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'list'; items: string[] };

export interface Resource {
  category: 'resource';
  slug: string;
  titre: string;
  description: string;
  formation: ResourceFormation;
  type: ResourceMetierType;
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
