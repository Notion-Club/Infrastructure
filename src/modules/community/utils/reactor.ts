import type { User } from "../types/user.types";
import type { Reaction, Reactor } from "../types/post.types";

// Convertit le viewer courant en Reactor pour l'afficher dans le hover popover /
// la bottom sheet de réactions. Avant : l'ajout optimiste d'une réaction ne
// portait AUCUN reactor → ReactionsBar retombait sur le placeholder « Membre N »
// (cf. getReactors), qui mentait sur l'identité de celui qui vient de réagir.
export function userToReactor(user: User): Reactor {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    avatarUrl: user.avatarUrl,
    avatarColor: user.avatarColor,
  };
}

// Applique un toggle de réaction optimiste en maintenant À LA FOIS le compteur,
// le flag `userReacted` ET la liste des reactors — pour que le viewer soit
// remonté dans le hover quand il like (fix « Membre 1 ») et retiré de la liste
// quand il retire sa réaction (fix « je persiste dans la liste »).
export function toggleReactionOptimistic(
  reactions: Reaction[],
  emoji: string,
  viewer: User,
): Reaction[] {
  const self = userToReactor(viewer);
  const existing = reactions.find((r) => r.emoji === emoji);

  if (existing) {
    const wasReacted = existing.userReacted;
    const nextCount = wasReacted ? existing.count - 1 : existing.count + 1;

    // Retrait de sa propre réaction sur une pastille qui tombe à 0 → on la
    // supprime entièrement de la barre.
    if (nextCount <= 0 && wasReacted) {
      return reactions.filter((r) => r.emoji !== emoji);
    }

    return reactions.map((r) => {
      if (r.emoji !== emoji) return r;
      const others = (r.reactors ?? []).filter((x) => x.id !== viewer.id);
      return {
        ...r,
        count: nextCount,
        userReacted: !wasReacted,
        // Ajoute le viewer en tête à l'ajout, le retire au retrait.
        reactors: wasReacted ? others : [self, ...others],
      };
    });
  }

  // Nouvelle réaction → le viewer en est le seul (et vrai) reactor.
  return [...reactions, { emoji, count: 1, userReacted: true, reactors: [self] }];
}
