export type ResourceType = "template" | "guide" | "redif";

export type Resource = {
  id: string;
  title: string;
  description: string;
  type: ResourceType;
  tags: string[];
  formation: string;
  locked?: boolean;
  url?: string;
};
