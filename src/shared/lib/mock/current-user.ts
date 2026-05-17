import type { UserCapability } from '@/modules/ressources/types';

export const mockCurrentUser = {
  id: 'user_1',
  prenom: 'Théo',
  // 'challenge' | 'formation' | 'accompagnement' — changer pour tester les verrous
  capability: 'formation' as UserCapability,
};
