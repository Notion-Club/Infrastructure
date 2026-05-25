"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { FeedbackBody } from "./LessonFeedback";

export type LessonFeedbackDetail = {
  courseName: string;
  formationName: string;
  moduleName: string;
};

type StartDetail = { feedback?: LessonFeedbackDetail };

const START = "nc:lesson-transition-start";
const READY = "nc:lesson-ready";

const MIN_VISIBLE = 600; // anti-flash sur chargement rapide
const FADE_MS = 280; // doit matcher la sortie .nc-lt-card
const CLOSE_MS = 2000; // compte à rebours de fermeture après envoi du feedback
const SAFETY_MS = 12000; // garde-fou si "ready" n'arrive jamais

// Déclenché par la navigation leçon → leçon, AVANT le router.push : il faut
// que le slot soit armé avant que React ne garde l'ancien contenu (la nav vit
// dans un startTransition, donc loading.tsx est court-circuité).
export function startLessonTransition(detail: StartDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StartDetail>(START, { detail }));
}

function signalLessonReady() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(READY));
}

// Monté à la fin de LessonView : la page leçon étant un Server Component qui
// `await` le fetch Notion, ce montage signale que le contenu est rendu.
export function LessonReady() {
  useEffect(() => {
    signalLessonReady();
  }, []);
  return null;
}

const skeleton: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
};

function LoadingHint() {
  return (
    <div style={{ padding: "26px 24px" }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-text-secondary)" }}>
        Chargement du cours…
      </p>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...skeleton, height: 14, width: "65%" }} />
        <div style={{ ...skeleton, height: 14, width: "88%" }} />
        <div style={{ ...skeleton, height: 150, borderRadius: 12, marginTop: 6 }} />
      </div>
    </div>
  );
}

// Slot de transition leçon → leçon. Enveloppe le contenu de la section
// formation : pendant le chargement du cours suivant, l'ancien contenu est
// masqué (mais monté, pour que le nouveau émette `ready`) et une carte type
// player-card prend sa place — elle héberge la barre de progression + le
// feedback du cours quitté, puis se dissout pour révéler le nouveau cours.
export function LessonTransition({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [feedback, setFeedback] = useState<LessonFeedbackDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [counting, setCounting] = useState(false); // remerciement → vidage de la barre du haut
  const [seq, setSeq] = useState(0);

  // Valeurs lues dans des callbacks asynchrones → refs (anti stale-closure).
  const activeRef = useRef(false);
  const feedbackRef = useRef<LessonFeedbackDetail | null>(null);
  const showFormRef = useRef(false);
  const engagedRef = useRef(false);
  const readyRef = useRef(false);
  const startTimeRef = useRef(0);

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    progressTimer.current = null;
    revealTimer.current = null;
    safetyTimer.current = null;
  }

  function reveal() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    progressTimer.current = null;
    safetyTimer.current = null;
    setRevealing(true);
    revealTimer.current = setTimeout(() => {
      activeRef.current = false;
      feedbackRef.current = null;
      showFormRef.current = false;
      engagedRef.current = false;
      readyRef.current = false;
      setActive(false);
      setRevealing(false);
      setFeedback(null);
      setShowForm(false);
      setProgress(0);
      setCounting(false);
    }, FADE_MS);
  }

  function decideReveal() {
    if (!activeRef.current || !readyRef.current) return;
    // On garde le slot tant que l'utilisateur donne son feedback : le contenu
    // est déjà chargé derrière, on ne le coupe pas en plein milieu.
    const stay = !!feedbackRef.current && engagedRef.current && showFormRef.current;
    if (stay) return;
    const elapsed = performance.now() - startTimeRef.current;
    const wait = Math.max(120, MIN_VISIBLE - elapsed);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(reveal, wait);
  }

  function onStart(detail: StartDetail) {
    clearTimers();
    const fb = detail.feedback ?? null;
    activeRef.current = true;
    feedbackRef.current = fb;
    showFormRef.current = !!fb;
    engagedRef.current = false;
    readyRef.current = false;
    startTimeRef.current = performance.now();

    setFeedback(fb);
    setShowForm(!!fb);
    setProgress(0);
    setCounting(false);
    setRevealing(false);
    setSeq((s) => s + 1);
    setActive(true);

    progressTimer.current = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      // Approche asymptotique de 90 % : rapide au début, puis ralentit.
      const p = 90 * (1 - Math.exp(-elapsed / 1100));
      setProgress((prev) => (prev >= 100 ? prev : Math.max(prev, p)));
    }, 70);

    safetyTimer.current = setTimeout(() => onReady(), SAFETY_MS);
  }

  function onReady() {
    if (!activeRef.current) return;
    readyRef.current = true;
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgress(100);
    decideReveal();
  }

  function onActivity() {
    engagedRef.current = true;
  }

  function onFeedbackClose() {
    showFormRef.current = false;
    setShowForm(false);
    decideReveal();
  }

  // Feedback envoyé : on réutilise la barre du HAUT comme compte à rebours de
  // fermeture (elle se vide en CLOSE_MS), puis on révèle le nouveau cours.
  function onFeedbackDone() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    progressTimer.current = null;
    safetyTimer.current = null;
    setCounting(true);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(reveal, CLOSE_MS);
  }

  // Listeners window liés une fois, mais appellent toujours le handler courant.
  const handlers = useRef({ onStart, onReady });
  handlers.current = { onStart, onReady };

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
      <div className="nc-mode-in" style={{ display: masked ? "none" : undefined }}>
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
              {/* Barre du haut : progression du chargement, puis (après envoi)
                  compte à rebours de fermeture en se vidant. */}
              <div style={{ height: 4, background: "var(--color-border-default)" }}>
                <div
                  style={{
                    height: "100%",
                    width: counting ? "0%" : `${progress}%`,
                    background: "var(--color-brand)",
                    transition: counting
                      ? `width ${CLOSE_MS}ms linear`
                      : "width 200ms linear",
                  }}
                />
              </div>

              {showForm && feedback ? (
                <div style={{ maxWidth: 460, margin: "0 auto" }}>
                  <FeedbackBody
                    key={seq}
                    courseName={feedback.courseName}
                    formationName={feedback.formationName}
                    moduleName={feedback.moduleName}
                    onClose={onFeedbackClose}
                    onActivity={onActivity}
                    onDone={onFeedbackDone}
                  />
                </div>
              ) : (
                <LoadingHint />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
