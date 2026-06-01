"use client";

import { useState, useEffect, useCallback } from "react";

export type DevRole = "free" | "paid" | "admin";
export type DevFeedState = "full" | "empty" | "loading" | "error";

const ROLE_KEY = "community:dev-role";
const STATE_KEY = "community:dev-state";

function readStorage<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return (v as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function useDevRoleToggle() {
  // ⚠️ Hydration : on initialise toujours avec la valeur par défaut côté SSR
  // ET côté client (1er render). La valeur réelle (localStorage) est lue dans
  // un useEffect APRÈS l'hydratation, pour éviter le mismatch
  // "tree hydrated but some attributes... didn't match" qui se déclenche dès
  // qu'un utilisateur a cliqué une fois sur un autre onglet du DevRoleToggle.
  const [role, setRoleState] = useState<DevRole>("paid");
  const [feedState, setFeedStateState] = useState<DevFeedState>("full");

  // Sync localStorage → state au mount (post-hydration).
  useEffect(() => {
    const storedRole = readStorage<DevRole>(ROLE_KEY, "paid");
    if (storedRole !== "paid") setRoleState(storedRole);
    const storedState = readStorage<DevFeedState>(STATE_KEY, "full");
    if (storedState !== "full") setFeedStateState(storedState);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(ROLE_KEY, role); } catch {}
  }, [role]);

  useEffect(() => {
    try { localStorage.setItem(STATE_KEY, feedState); } catch {}
  }, [feedState]);

  const setRole = useCallback((r: DevRole) => setRoleState(r), []);
  const setFeedState = useCallback((s: DevFeedState) => setFeedStateState(s), []);

  return { role, setRole, feedState, setFeedState };
}
