"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  Capability,
  DevCapability,
  DevProgressLevel,
  DevSpecialState,
  Program,
  UserProgress,
} from "../types";
import {
  MOCK_PROGRAMS,
  MOCK_PROGRAMS_BY_SLUG,
} from "../mocks/formation.mock";
import {
  buildProgressFromLevel,
  devCapabilityToCapabilities,
} from "../lib/devOverrides";

// ─── État partagé sur toute l'arbo /formation/* ────────────────────────
//
// Le contexte porte :
//   - les 3 sélecteurs du toggle dev (capability, progression, état spécial)
//   - le UserProgress effectif (mock initial dérivé du niveau + edits locaux)
//   - les capabilities effectives
//   - les programmes (pour éviter d'importer les mocks partout)
//   - les actions de mise à jour (markCompleted, setNote, setLastAccessed)
//
// La persistance localStorage permet de conserver l'état du toggle entre
// navigations. Le state local (complétion edits, notes) est perdu au
// refresh — c'est OK pour une maquette.

type FormationContextValue = {
  programs: Program[];
  getProgramBySlug: (slug: string) => Program | undefined;

  // Toggle dev
  devCapability: DevCapability;
  setDevCapability: (c: DevCapability) => void;
  devProgressLevel: DevProgressLevel;
  setDevProgressLevel: (l: DevProgressLevel) => void;
  devSpecial: DevSpecialState;
  setDevSpecial: (s: DevSpecialState) => void;

  // État dérivé
  capabilities: Capability[];
  progress: UserProgress;

  // Mutations locales
  markCompleted: (lessonId: string) => void;
  toggleCompleted: (lessonId: string) => void;
  setNote: (lessonId: string, content: string) => void;
  setLastAccessed: (lessonId: string) => void;
};

const FormationContext = createContext<FormationContextValue | null>(null);

const KEY_CAP = "formation:dev-capability";
const KEY_PROG = "formation:dev-progress";
const KEY_SPEC = "formation:dev-special";

function readLs<T extends string | number>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    if (typeof fallback === "number") {
      const n = Number(v);
      return (Number.isFinite(n) ? n : fallback) as T;
    }
    return v as T;
  } catch {
    return fallback;
  }
}

export function FormationProvider({ children }: { children: ReactNode }) {
  const [devCapability, setDevCapabilityState] = useState<DevCapability>(() =>
    readLs<DevCapability>(KEY_CAP, "paid_and_challenge"),
  );
  const [devProgressLevel, setDevProgressLevelState] =
    useState<DevProgressLevel>(() =>
      readLs<DevProgressLevel>(KEY_PROG, 30),
    );
  const [devSpecial, setDevSpecialState] = useState<DevSpecialState>(() =>
    readLs<DevSpecialState>(KEY_SPEC, "normal"),
  );

  // Edits locaux à la session : complétions ajoutées/retirées, notes
  // saisies, dernière leçon ouverte. Indexés par lessonId pour pouvoir
  // override la progression dérivée du toggle dev.
  const [localCompletions, setLocalCompletions] = useState<
    Record<string, boolean>
  >({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [localLastAccessed, setLocalLastAccessed] = useState<string | null>(
    null,
  );

  // Quand on change capability/progress depuis le toggle, on reset les
  // edits locaux pour que la simulation reflète exactement le niveau
  // choisi. Les setters wrappés gèrent reset + persist localStorage en
  // une opération synchrone — pas d'useEffect en cascade.
  const setDevCapability = useCallback((c: DevCapability) => {
    setDevCapabilityState(c);
    setLocalCompletions({});
    setLocalNotes({});
    setLocalLastAccessed(null);
    try {
      localStorage.setItem(KEY_CAP, c);
    } catch {}
  }, []);

  const setDevProgressLevel = useCallback((l: DevProgressLevel) => {
    setDevProgressLevelState(l);
    setLocalCompletions({});
    setLocalNotes({});
    setLocalLastAccessed(null);
    try {
      localStorage.setItem(KEY_PROG, String(l));
    } catch {}
  }, []);

  const setDevSpecial = useCallback((s: DevSpecialState) => {
    setDevSpecialState(s);
    try {
      localStorage.setItem(KEY_SPEC, s);
    } catch {}
  }, []);

  const capabilities = useMemo(
    () => devCapabilityToCapabilities(devCapability),
    [devCapability],
  );

  // Progress effectif = mock dérivé du niveau + overrides locaux.
  const progress = useMemo<UserProgress>(() => {
    const base = buildProgressFromLevel(devProgressLevel, MOCK_PROGRAMS);
    const completedSet = new Set(base.completedLessonIds);
    for (const [id, completed] of Object.entries(localCompletions)) {
      if (completed) completedSet.add(id);
      else completedSet.delete(id);
    }
    return {
      completedLessonIds: Array.from(completedSet),
      lessonNotes: { ...base.lessonNotes, ...localNotes },
      lastAccessedLessonId: localLastAccessed ?? base.lastAccessedLessonId,
    };
  }, [devProgressLevel, localCompletions, localNotes, localLastAccessed]);

  const markCompleted = useCallback((lessonId: string) => {
    setLocalCompletions((prev) => ({ ...prev, [lessonId]: true }));
  }, []);

  const toggleCompleted = useCallback(
    (lessonId: string) => {
      setLocalCompletions((prev) => {
        const currentMockHasIt = progress.completedLessonIds.includes(lessonId);
        return { ...prev, [lessonId]: !currentMockHasIt };
      });
    },
    [progress.completedLessonIds],
  );

  const setNote = useCallback((lessonId: string, content: string) => {
    setLocalNotes((prev) => ({ ...prev, [lessonId]: content }));
  }, []);

  const setLastAccessed = useCallback((lessonId: string) => {
    setLocalLastAccessed(lessonId);
  }, []);

  const value = useMemo<FormationContextValue>(
    () => ({
      programs: MOCK_PROGRAMS,
      getProgramBySlug: (slug: string) => MOCK_PROGRAMS_BY_SLUG[slug],
      devCapability,
      setDevCapability,
      devProgressLevel,
      setDevProgressLevel,
      devSpecial,
      setDevSpecial,
      capabilities,
      progress,
      markCompleted,
      toggleCompleted,
      setNote,
      setLastAccessed,
    }),
    [
      devCapability,
      setDevCapability,
      devProgressLevel,
      setDevProgressLevel,
      devSpecial,
      setDevSpecial,
      capabilities,
      progress,
      markCompleted,
      toggleCompleted,
      setNote,
      setLastAccessed,
    ],
  );

  return (
    <FormationContext.Provider value={value}>
      {children}
    </FormationContext.Provider>
  );
}

export function useFormationContext(): FormationContextValue {
  const ctx = useContext(FormationContext);
  if (!ctx) {
    throw new Error(
      "useFormationContext doit être utilisé dans <FormationProvider>",
    );
  }
  return ctx;
}
