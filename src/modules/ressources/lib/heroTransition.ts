/**
 * Nom de `view-transition` partagé entre la carte de la grille et l'élément
 * correspondant de la page détail (encadré + son skeleton de chargement).
 *
 * On le pose via le composant React `<ViewTransition name=…>` : React repère les
 * éléments portant le MÊME nom dans l'ancien et le nouvel arbre et morphe l'un
 * vers l'autre (position + taille). Le nom est unique par item, donc plusieurs
 * cartes peuvent le porter simultanément sans conflit — React n'anime que celle
 * qui « persiste » d'une page à l'autre.
 *
 * `kind` sépare les espaces ressource/template (slugs potentiellement communs).
 */
export const heroVtName = (kind: 'res' | 'tpl', slug: string): string =>
  `nc-${kind}-${slug}`;
