/**
 * Nom de `view-transition` partagé entre la carte cliquée dans la grille et
 * l'encadré de la page détail (page réelle + son skeleton `loading.tsx`).
 *
 * Un seul élément porte ce nom à la fois : sur la grille, uniquement la carte en
 * cours d'ouverture (cf. `useActiveHero`) ; sur le détail, l'encadré de contenu.
 * Le navigateur peut donc morpher la carte → encadré à l'ouverture, et l'encadré
 * → carte au retour (« Revenir à Ressources »).
 *
 * Volontairement isolé dans un module sans import React : il est consommé aussi
 * bien par les Server Components (pages détail + loading) que par le store
 * client `useActiveHero`.
 */
export const HERO_VT_NAME = 'nc-resource-hero';
