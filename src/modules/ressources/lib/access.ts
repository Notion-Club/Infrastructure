import type { UserCapability, ResourceVisibility } from '../types';

const CAPABILITY_RANK: Record<UserCapability, number> = {
  challenge: 0,
  formation: 1,
  accompagnement: 2,
};

const VISIBILITY_RANK: Record<ResourceVisibility, number> = {
  Publique: -1,
  'Challenge Gratuit': 0,
  Formation: 1,
  Accompagnement: 2,
};

export function canAccess(capability: UserCapability, visibilite: ResourceVisibility): boolean {
  return CAPABILITY_RANK[capability] >= VISIBILITY_RANK[visibilite];
}
