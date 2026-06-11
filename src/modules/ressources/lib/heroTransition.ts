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

/**
 * Nom dédié au TITRE. Un descendant qui possède son propre `view-transition-name`
 * est capturé dans son PROPRE groupe et exclu du snapshot de la surface : le
 * titre morphe donc net (position + taille interpolées) au lieu de fantômer dans
 * l'image de la surface. Posé sur le `<h3>` de la carte héros, le `<h1>` de la
 * page détail et le placeholder titre du `loading.tsx`.
 */
export const HERO_TITLE_VT_NAME = 'nc-resource-hero-title';

