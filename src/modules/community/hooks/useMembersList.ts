"use client";

import { useEffect, useState } from "react";
import { listMembersAction } from "../server/actions";
import type { CommunityMember } from "../server/queries";

// Cache module-level (singleton par session navigateur). La liste des membres
// du Notion Club bouge très lentement (un nouveau membre par jour au max),
// donc on peut largement la garder en mémoire pour la session. Ça transforme
// les ouvertures suivantes du modal Forward (et tout autre consommateur) en
// rendu instantané au lieu d'un round-trip Server Action de 200-700 ms.
//
// 3 états globaux partagés entre tous les consommateurs du hook :
//   - cache       : la liste résolue (null si jamais fetché)
//   - inflight    : la promesse en cours (null si idle ou résolu) — évite
//                   les fetch concurrents quand plusieurs composants montent
//                   simultanément (cas ForwardModal + NewConversationModal
//                   ouverts en même temps, ou double-mount StrictMode).
//   - subscribers : Set de callbacks (un par hook actif) à notifier quand
//                   le cache change. Sans ça, un useState local ne se met
//                   pas à jour quand la promise commune résout.
let cache: CommunityMember[] | null = null;
let inflight: Promise<CommunityMember[]> | null = null;
const subscribers = new Set<(list: CommunityMember[]) => void>();

function notify(list: CommunityMember[]) {
  for (const cb of subscribers) cb(list);
}

// Lance un fetch si pas déjà en cache ni en cours. Renvoie la promesse en
// cours (qu'on peut await depuis prefetch sans handler React).
function ensureLoaded(): Promise<CommunityMember[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = listMembersAction()
    .then((list) => {
      cache = list;
      inflight = null;
      notify(list);
      return list;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

// API publique pour prefetcher en background — appelé par le hover du
// kebab par exemple, AVANT que l'utilisateur clique sur "Transférer".
// Ne renvoie rien, ne throw rien — best effort.
export function prefetchMembersList(): void {
  if (cache || inflight) return;
  ensureLoaded().catch(() => {
    // silencieux : si le prefetch échoue, le hook réessaiera à l'ouverture
    // de la modale et affichera l'erreur à ce moment-là (UX correcte).
  });
}

// Permet d'invalider le cache après une action qui modifie la liste des
// membres (ex: un user qui change son nom, supprime son compte). Pour V1
// on ne l'utilise nulle part — le cache vit toute la session.
export function invalidateMembersList(): void {
  cache = null;
  inflight = null;
}

interface UseMembersListResult {
  members: CommunityMember[];
  loading: boolean;
  error: string | null;
}

// Hook React qui retourne la liste cachée si dispo, sinon déclenche le
// fetch et garde le composant à jour quand la promise résout.
export function useMembersList(): UseMembersListResult {
  // Si on a un cache, on initialise direct dessus → rendu instantané, pas
  // de flash "Chargement". C'est le bénéfice principal du cache.
  const [members, setMembers] = useState<CommunityMember[]>(cache ?? []);
  const [loading, setLoading] = useState<boolean>(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Souscription : on s'inscrit pour être notifié quand le cache change.
    // Permet le partage entre plusieurs composants montés simultanément.
    const cb = (list: CommunityMember[]) => {
      setMembers(list);
      setLoading(false);
    };
    subscribers.add(cb);

    // Si déjà en cache, on est déjà à jour — pas besoin de fetch.
    if (cache) {
      setMembers(cache);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);
      ensureLoaded().catch((err) => {
        console.error("[useMembersList] fetch failed:", err);
        setError("Impossible de charger la liste des membres.");
        setLoading(false);
      });
    }

    return () => {
      subscribers.delete(cb);
    };
  }, []);

  return { members, loading, error };
}
