"use client";

import { useEffect, useState } from "react";
import { getUserTopEmojisAction } from "../server/actions";

// Defaults exposés pour le SSR / l'état initial — alignés sur ceux du
// server action (DEFAULT_TOP_EMOJIS). Dupliquer côté front évite un await
// asynchrone au mount qui causerait un layout shift dans la toolbar.
const FALLBACK_EMOJIS = ["👍", "😂", "🙌"];
const LS_KEY = "nc:user-top-emojis:v1";

// Hook qui retourne les 3 emojis favoris du user courant pour la toolbar
// quick-reaction du MessageBubble. Stratégie :
//   1. Lit localStorage au mount → render instantané (pas de flash).
//   2. Lance un fetch en background → met à jour si différent + persiste.
//
// La RPC server-side get_user_top_emojis (mig. 029) est rapide (<5 ms,
// lecture indexée), mais on évite quand même de la rappeler à chaque
// hover de message. Le cache localStorage suffit largement pour la durée
// d'une session.
export function useUserTopEmojis(): string[] {
  const [emojis, setEmojis] = useState<string[]>(FALLBACK_EMOJIS);

  useEffect(() => {
    // Hydratation depuis localStorage (synchrone, pas de flash).
    try {
      const cached = window.localStorage.getItem(LS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as string[];
        if (Array.isArray(parsed) && parsed.length === 3) {
          setEmojis(parsed);
        }
      }
    } catch {
      // localStorage indisponible (private mode Safari, etc.) — on continue
      // avec les defaults, pas grave.
    }

    // Refresh en background.
    let cancelled = false;
    getUserTopEmojisAction().then((result) => {
      if (cancelled) return;
      setEmojis(result.emojis);
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(result.emojis));
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return emojis;
}
