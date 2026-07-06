"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Post } from "../../../types/post.types";
import type { User } from "../../../types/user.types";
import type { DevRole } from "../../../hooks/useDevRoleToggle";
import { PostMorphOverlay } from "./PostMorphOverlay";

// Contrôleur du morph d'ouverture/fermeture des cartes du FEED (posts). Repris
// du mécanisme validé du module Ressources (règle d'isolation : duplication, pas
// d'import cross-module). Plus AUCUNE navigation : la carte cliquée ouvre un
// overlay en portail, lu depuis le post DÉJÀ chargé (le feed porte tout le
// contenu). Les commentaires sont hydratés en async (Server Action). Le feed ne
// se démonte jamais → fond statique, fermeture sans re-cascade.
export interface PostMorphSource {
  /** Post complet de la carte (contenu inclus ; commentaires chargés en async). */
  post: Post;
  /** Géométrie de la carte au clic (point de départ du morph). */
  cardRect: DOMRect;
  /** Géométrie du titre de la carte (ancre du titre continu « hero »). */
  titleRect: DOMRect;
  /** Élément déclencheur — pour restituer le focus à la fermeture (a11y). */
  triggerEl?: HTMLElement | null;
  /** Ouverture au CLAVIER ? Sinon (souris/tactile) on ne restitue pas le focus
   *  à la fermeture → pas d'encadré bleu de sélection iOS. */
  viaKeyboard?: boolean;
}

interface PostMorphCtx {
  open: (source: PostMorphSource) => void;
  source: PostMorphSource | null;
}

const PostMorphContext = createContext<PostMorphCtx | null>(null);

export function PostMorphProvider({
  currentUser,
  devRole,
  children,
}: {
  currentUser: User;
  devRole: DevRole;
  children: ReactNode;
}) {
  const [source, setSource] = useState<PostMorphSource | null>(null);

  const open = useCallback((s: PostMorphSource) => setSource(s), []);
  // Démontage réel APRÈS l'animation de fermeture : l'overlay appelle onClose une
  // fois le morph de sortie terminé → la fermeture a le temps de jouer.
  const handleClosed = useCallback(() => setSource(null), []);

  return (
    <PostMorphContext.Provider value={{ open, source }}>
      {children}
      {source && (
        <PostMorphOverlay
          // Remonte un overlay NEUF par post → aucun résidu de l'animation
          // précédente (refs/anims repartent de zéro).
          key={source.post.id}
          source={source}
          currentUser={currentUser}
          devRole={devRole}
          onClose={handleClosed}
        />
      )}
    </PostMorphContext.Provider>
  );
}

export function usePostMorph(): PostMorphCtx {
  const ctx = useContext(PostMorphContext);
  if (!ctx) throw new Error("usePostMorph doit être utilisé sous <PostMorphProvider>");
  return ctx;
}
