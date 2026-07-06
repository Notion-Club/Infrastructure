"use server";

// Server Action — charge les commentaires (+ réponses + réactions) d'un post
// pour l'OVERLAY de morph du feed (composant client). Le feed ne porte que les
// posts (sans commentaires) : l'overlay s'ouvre instantanément avec le contenu
// du post déjà en mémoire, puis appelle cette action pour hydrater les
// commentaires — sans navigation (aucun re-mount du feed). Même source que la
// vraie page détail (`listCommentsForPost`) → rendu identique.

import { listCommentsForPost } from "./queries";
import type { Comment } from "../types/comment.types";

export async function getPostComments(postId: string): Promise<Comment[]> {
  return listCommentsForPost(postId);
}
