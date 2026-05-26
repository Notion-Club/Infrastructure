"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { FeedbackBody } from "./LessonFeedback";

export type LessonFeedbackDetail = {
  courseName: string;
  formationName: string;
  moduleName: string;
};

// Destination de la navigation : détermine quel skeleton afficher.
export type Destination = "lesson" | "program" | "program-index";

type StartDetail = {
  feedback?: LessonFeedbackDetail;
  destination?: Destination;
};

const START = "nc:lesson-transition-start";
const READY = "nc:lesson-ready";

const AUTO_CLOSE_MS = 12000;
const MIN_CROSS = 5000;
const ANTIFLASH = 500;
const FADE_MS = 280;
const CLOSE_MS = 2000;
const SAFETY_MS = 20000;
// Délai max d'attente du chargement des iframes (Tella player) avant de
// signaler ready de toute façon — évite de bloquer indéfiniment.
const IFRAME_WAIT_MAX = 6000;

export function startLessonTransition(detail: StartDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StartDetail>(START, { detail }));
}

function signalLessonReady() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(READY));
}

// Monté à la fin de chaque page formation. Attend que tous les iframes de
// <main> (vidéos Tella) aient chargé leur player avant de signaler ready,
// pour éviter que le voile se lève avant que la vidéo ne soit visible.
export function LessonReady() {
  useEffect(() => {
    const iframes = Array.from(
      document.querySelectorAll<HTMLIFrameElement>("main iframe[src]"),
    );

    if (iframes.length === 0) {
      signalLessonReady();
      return;
    }

    let signaled = false;
    function signal() {
      if (signaled) return;
      signaled = true;
      signalLessonReady();
    }

    const maxWait = setTimeout(signal, IFRAME_WAIT_MAX);
    let pending = iframes.length;
    const cleanups: Array<() => void> = [];

    iframes.forEach((iframe) => {
      function onLoad() {
        pending--;
        if (pending <= 0) {
          clearTimeout(maxWait);
          signal();
        }
      }
      iframe.addEventListener("load", onLoad, { once: true });
      cleanups.push(() => iframe.removeEventListener("load", onLoad));
    });

    return () => {
      clearTimeout(maxWait);
      cleanups.forEach((fn) => fn());
    };
  }, []);
  return null;
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

const sk: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
};

// Skeleton du player leçon (titre + description + vidéo + lignes de body).
function LessonContentSkeleton() {
  return (
    <div style={{ padding: "24px 24px 26px" }}>
      <div style={{ ...sk, height: 22, width: "55%" }} />
      <div style={{ ...sk, height: 13, width: "38%", marginTop: 12 }} />
      <div style={{ ...sk, height: 230, borderRadius: 14, marginTop: 20 }} />
      <div style={{ ...sk, height: 13, width: "92%", marginTop: 20 }} />
      <div style={{ ...sk, height: 13, width: "84%", marginTop: 10 }} />
      <div style={{ ...sk, height: 13, width: "70%", marginTop: 10 }} />
    </div>
  );
}

// Skeleton de la page programme (/formation/[slug]).
function ProgramSkeleton() {
  return (
    <div className="nc-lt-page" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Lien retour */}
      <div style={{ ...sk, height: 14, width: 148, borderRadius: 4 }} />

      {/* En-tête */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...sk, height: 46, width: "60%", borderRadius: 8 }} />
        <div style={{ ...sk, height: 15, width: "76%", borderRadius: 4 }} />
        <div style={{ marginTop: 8, maxWidth: 480, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...sk, height: 8, borderRadius: 9999 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ ...sk, height: 12, width: "42%", borderRadius: 4 }} />
            <div style={{ ...sk, height: 12, width: 36, borderRadius: 4 }} />
          </div>
        </div>
      </div>

      {/* Accordéons de modules */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {([1, 0.85, 0.7, 0.55] as const).map((opacity, i) => (
          <div key={i} style={{ ...sk, height: 64, borderRadius: 16, opacity }} />
        ))}
      </div>
    </div>
  );
}

// Skeleton de l'index des programmes (/formation).
function ProgramIndexSkeleton() {
  return (
    <div className="nc-lt-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* En-tête */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
        <div style={{ ...sk, height: 12, width: 72, borderRadius: 4 }} />
        <div style={{ ...sk, height: 44, width: "52%", borderRadius: 8 }} />
        <div style={{ ...sk, height: 15, width: "68%", marginTop: 2, borderRadius: 4 }} />
      </div>
      {/* Cards de programme */}
      <div style={{ ...sk, height: 240, borderRadius: 20 }} />
      <div style={{ ...sk, height: 160, borderRadius: 20, opacity: 0.7 }} />
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function LessonTransition({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [feedback, setFeedback] = useState<LessonFeedbackDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [barMode, setBarMode] = useState<"count" | "empty">("count");
  const [canClose, setCanClose] = useState(false);
  const [seq, setSeq] = useState(0);
  const [destination, setDestination] = useState<Destination>("lesson");

  const activeRef = useRef(false);
  const readyRef = useRef(false);
  const closingRef = useRef(false);
  const hasFormRef = useRef(false);
  const startTimeRef = useRef(0);

  const contentRef = useRef<HTMLDivElement>(null);

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crossTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (crossTimer.current) clearTimeout(crossTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    progressTimer.current = null;
    revealTimer.current = null;
    crossTimer.current = null;
    safetyTimer.current = null;
  }

  function reveal() {
    clearTimers();
    setRevealing(true);
    revealTimer.current = setTimeout(() => {
      activeRef.current = false;
      readyRef.current = false;
      closingRef.current = false;
      setActive(false);
      setRevealing(false);
      setFeedback(null);
      setShowForm(false);
      setProgress(0);
      setBarMode("count");
      setCanClose(false);
    }, FADE_MS);
  }

  function enableClose() {
    if (!activeRef.current || closingRef.current) return;
    if (crossTimer.current) clearTimeout(crossTimer.current);
    crossTimer.current = null;
    setCanClose(true);
  }

  function onStart(detail: StartDetail) {
    clearTimers();
    const fb = detail.feedback ?? null;
    activeRef.current = true;
    readyRef.current = false;
    closingRef.current = false;
    hasFormRef.current = !!fb;
    startTimeRef.current = performance.now();

    setDestination(detail.destination ?? "lesson");
    setFeedback(fb);
    setShowForm(!!fb);
    setProgress(0);
    setBarMode("count");
    setCanClose(false);
    setRevealing(false);
    setSeq((s) => s + 1);
    setActive(true);

    progressTimer.current = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const p = Math.min(100, (elapsed / AUTO_CLOSE_MS) * 100);
      setProgress((prev) => Math.max(prev, p));
    }, 60);

    safetyTimer.current = setTimeout(reveal, SAFETY_MS);
  }

  function onReady() {
    if (!activeRef.current || readyRef.current) return;
    readyRef.current = true;
    const elapsed = performance.now() - startTimeRef.current;
    if (hasFormRef.current) {
      if (crossTimer.current) clearTimeout(crossTimer.current);
      crossTimer.current = setTimeout(enableClose, Math.max(0, MIN_CROSS - elapsed));
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(reveal, Math.max(0, AUTO_CLOSE_MS - elapsed));
    } else {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(reveal, Math.max(0, ANTIFLASH - elapsed));
    }
  }

  function onFeedbackClose() {
    reveal();
  }

  function onFeedbackDone() {
    closingRef.current = true;
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (crossTimer.current) clearTimeout(crossTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    progressTimer.current = null;
    crossTimer.current = null;
    safetyTimer.current = null;
    setBarMode("empty");
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(reveal, CLOSE_MS);
  }

  // Quand revealing passe à true, le contenu redevient visible.
  // Double RAF pour forcer le navigateur à relancer nc-mode-in sur un élément
  // déjà monté (sinon l'animation est considérée comme déjà jouée).
  useEffect(() => {
    if (!revealing) return;
    const el = contentRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.animation = "none";
      requestAnimationFrame(() => {
        el.style.animation = "";
      });
    });
  }, [revealing]);

  const handlers = useRef({ onStart, onReady });
  useEffect(() => {
    handlers.current = { onStart, onReady };
  });

  useEffect(() => {
    const onStartEv = (e: Event) =>
      handlers.current.onStart((e as CustomEvent<StartDetail>).detail ?? {});
    const onReadyEv = () => handlers.current.onReady();
    window.addEventListener(START, onStartEv);
    window.addEventListener(READY, onReadyEv);
    return () => {
      window.removeEventListener(START, onStartEv);
      window.removeEventListener(READY, onReadyEv);
      clearTimers();
    };
  }, []);

  const masked = active && !revealing;

  return (
    <div style={{ position: "relative" }}>
      <div ref={contentRef} className="nc-mode-in" style={{ display: masked ? "none" : undefined }}>
        {children}
      </div>

      {active && (
        <div
          className="nc-lt-layer"
          data-revealing={revealing}
          role="status"
          aria-live="polite"
          style={revealing ? { position: "absolute", inset: 0 } : undefined}
        >
          {destination === "lesson" ? (
            // Overlay "cours" : card avec barre de progression + skeleton player
            // + formulaire de feedback optionnel.
            <div style={{ maxWidth: 880, margin: "0 auto" }}>
              <div
                className="nc-lt-card"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "var(--nc-shadow-2)",
                }}
              >
                <div style={{ height: 4, background: "var(--color-border-default)" }}>
                  <div
                    style={{
                      height: "100%",
                      width: barMode === "empty" ? "0%" : `${progress}%`,
                      background: "var(--color-brand)",
                      transition:
                        barMode === "empty"
                          ? `width ${CLOSE_MS}ms linear`
                          : "width 120ms linear",
                    }}
                  />
                </div>

                <div style={{ display: "grid" }}>
                  <div style={{ gridArea: "1 / 1" }}>
                    <LessonContentSkeleton />
                  </div>

                  {showForm && feedback && (
                    <div
                      className="nc-lt-scrim"
                      style={{
                        gridArea: "1 / 1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16,
                      }}
                    >
                      <div className="nc-lt-form" style={{ width: "100%", maxWidth: 420 }}>
                        <div className="nc-lt-form__inner">
                          <FeedbackBody
                            key={seq}
                            courseName={feedback.courseName}
                            formationName={feedback.formationName}
                            moduleName={feedback.moduleName}
                            onClose={onFeedbackClose}
                            onDone={onFeedbackDone}
                            closable={canClose}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : destination === "program" ? (
            <ProgramSkeleton />
          ) : (
            <ProgramIndexSkeleton />
          )}
        </div>
      )}
    </div>
  );
}
