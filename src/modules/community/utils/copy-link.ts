import { toast } from "sonner";

/**
 * URL publique d'un post de la communauté.
 * `window.location.origin` : ces helpers ne sont appelés que côté client
 * (handlers de menu kebab), l'origine est donc toujours disponible.
 */
export function buildPostLink(postId: string): string {
  return `${window.location.origin}/communaute/post/${postId}`;
}

/**
 * URL d'un commentaire (ou d'une réponse) : une position dans le thread du post,
 * pas une ressource autonome. Query param `?comment=` plutôt que hash car la
 * page détail doit pouvoir cibler et, au besoin, déplier le bon élément côté
 * client avant de scroller/surligner.
 */
export function buildCommentLink(postId: string, commentId: string): string {
  return `${buildPostLink(postId)}?comment=${commentId}`;
}

/** Copie un lien dans le presse-papier puis affiche un toast de confirmation. */
export async function copyCommunityLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  } catch {
    toast.error("Impossible de copier le lien");
  }
}
