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
  const [role, setRoleState] = useState<DevRole>(() =>
    readStorage<DevRole>(ROLE_KEY, "paid")
  );
  const [feedState, setFeedStateState] = useState<DevFeedState>(() =>
    readStorage<DevFeedState>(STATE_KEY, "full")
  );

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
