// Marqueur de route pour /communaute (sans sous-segment). Le rendu vit dans
// communaute/layout.tsx ; sans sous-segment, CommunityPage affiche le feed par
// défaut (usePathname() ne matche pas /messages). On ne redirige PLUS vers
// /communaute/feed : un redirect serveur ajoutait un hop (307) + un flash de
// loading.tsx à chaque entrée. /communaute affiche donc directement le feed,
// et le switcher/les liens explicites (/communaute/feed, /communaute/messages)
// restent disponibles.
export default function CommunautePage() {
  return null;
}
