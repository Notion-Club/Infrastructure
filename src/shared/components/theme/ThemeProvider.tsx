"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// User-facing preference. "system" follows prefers-color-scheme.
export type ThemePreference = "light" | "dark" | "system";
// Effective theme applied to <html>.
export type Theme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  theme: Theme;
  setPreference: (next: ThemePreference) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  if (typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") {
    return stored;
  }
  return "system";
}

function resolveTheme(pref: ThemePreference): Theme {
  return pref === "system" ? systemTheme() : pref;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Also react to OS-level theme changes while "system" is active.
  let media: MediaQueryList | null = null;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPreference() === "system") {
        applyTheme(systemTheme());
        emit();
      }
    };
    media.addEventListener("change", onChange);
    return () => {
      listeners.delete(cb);
      media?.removeEventListener("change", onChange);
    };
  }
  return () => {
    listeners.delete(cb);
  };
}

function emit() {
  listeners.forEach((cb) => cb());
}

function writePreference(pref: ThemePreference) {
  applyTheme(resolveTheme(pref));
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // localStorage may be unavailable (private mode, quota); ignore.
  }
  emit();
}

function readSnapshot(): { preference: ThemePreference; theme: Theme } {
  const preference = readPreference();
  return { preference, theme: resolveTheme(preference) };
}

const SERVER_SNAPSHOT: { preference: ThemePreference; theme: Theme } = {
  preference: "system",
  theme: "light",
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    readSnapshot,
    () => SERVER_SNAPSHOT,
  );

  const setPreference = useCallback((next: ThemePreference) => {
    writePreference(next);
  }, []);

  const toggleTheme = useCallback(() => {
    // Toggle treats current effective theme: light ↔ dark, ignores system.
    const current = readSnapshot().theme;
    writePreference(current === "dark" ? "light" : "dark");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference: snapshot.preference,
      theme: snapshot.theme,
      setPreference,
      toggleTheme,
    }),
    [snapshot.preference, snapshot.theme, setPreference, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
