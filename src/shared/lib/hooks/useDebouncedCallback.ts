"use client";

import { useCallback, useEffect, useRef } from "react";

// Débounce générique : renvoie une fonction stable qui ne déclenche `callback`
// qu'après `delayMs` sans nouvel appel. Utilisé pour l'auto-enregistrement des
// Réglages (regroupe les frappes / toggles rapprochés en un seul write
// Supabase, au lieu d'un appel par caractère ou par clic).
//
// La callback est lue via une ref tenue à jour à chaque render, de sorte que
// le timer en attente appelle TOUJOURS la dernière version (dernier état
// capturé) sans qu'on ait à recréer le timer ni à invalider l'identité de la
// fonction retournée.
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
): (...args: TArgs) => void {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Garde la ref synchro avec la dernière callback fournie.
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Nettoyage à l'unmount : annule un éventuel save en attente.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(
    (...args: TArgs) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
}
