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

type Snapshot = { preference: ThemePreference; theme: Theme };

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
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage may throw (private mode, sandboxed iframe); fall through.
  }
  return "system";
}

function resolveTheme(pref: ThemePreference): Theme {
  return pref === "system" ? systemTheme() : pref;
}

// ── Store ────────────────────────────────────────────────────────────────
// useSyncExternalStore requires getSnapshot() to be cached: if it returned
// a fresh object every call, React would detect an infinite loop and abort
// rendering ("This page couldn't load" on Vercel).
const SERVER_SNAPSHOT: Snapshot = { preference: "system", theme: "light" };
let currentSnapshot: Snapshot = SERVER_SNAPSHOT;

function computeSnapshot(): Snapshot {
  const preference = readPreference();
  const theme = resolveTheme(preference);
  // Reuse the cached object when nothing changed — Object.is identity matters.
  if (
    currentSnapshot.preference === preference &&
    currentSnapshot.theme === theme
  ) {
    return currentSnapshot;
  }
  currentSnapshot = { preference, theme };
  return currentSnapshot;
}

const listeners = new Set<() => void>();

function emit() {
  computeSnapshot();
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Track OS-level theme changes only when "system" is active.
  let media: MediaQueryList | null = null;
  let onChange: (() => void) | null = null;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    onChange = () => {
      if (readPreference() === "system") {
        applyTheme(systemTheme());
        emit();
      }
    };
    media.addEventListener("change", onChange);
  }
  return () => {
    listeners.delete(cb);
    if (media && onChange) media.removeEventListener("change", onChange);
  };
}

function writePreference(pref: ThemePreference) {
  applyTheme(resolveTheme(pref));
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // localStorage may be unavailable; ignore.
  }
  emit();
}

function getClientSnapshot(): Snapshot {
  // Recompute the cached snapshot once per read so first-render-after-mount
  // sees the real client value (localStorage / matchMedia).
  return computeSnapshot();
}

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const setPreference = useCallback((next: ThemePreference) => {
    writePreference(next);
  }, []);

  const toggleTheme = useCallback(() => {
    // Toggle works on the effective theme (light ↔ dark), persisting an
    // explicit preference rather than leaving "system" mode untouched.
    const current = computeSnapshot().theme;
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
