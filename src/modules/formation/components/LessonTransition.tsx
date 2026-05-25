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

const READ_MS = 12000; // fenêtre minimale pour lire / répondre au feedback
const ACTIVITY_GRACE = 6000; // rallonge la fenêtre après chaque interaction
const FADE_MS = 280; // doit matcher la sortie .nc-lt-card
const CLOSE_MS = 2000; // compte à rebours de fermeture après envoi du feedback
const SAFETY_MS = 22000; // garde-fou ultime (révèle même si "ready" perdu)

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

// Placeholder du contenu en chargement (titre + description + player + body).
// Reste TOUJOURS visible derrière le formulaire de feedback en surimpression.
function ContentSkeleton() {
  return (
    <div style={{ padding: "24px 24px 26px" }}>
      <div style={{ ...skeleton, height: 22, width: "55%" }} />
      <div style={{ ...skeleton, height: 13, width: "38%", marginTop: 12 }} />
      <div style={{ ...skeleton, height: 230, borderRadius: 14, marginTop: 20 }} />
      <div style={{ ...skeleton, height: 13, width: "92%", marginTop: 20 }} />
      <div style={{ ...skeleton, height: 13, width: "84%", marginTop: 10 }} />
      <div style={{ ...skeleton, height: 13, width: "70%", marginTop: 10 }} />
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
  const readyRef = useRef(false);
  const countingRef = useRef(false);
  const startTimeRef = useRef(0);
  const deadlineRef = useRef(0); // instant cible de révélation auto

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
    clearTimers();
    setRevealing(true);
    revealTimer.current = setTimeout(() => {
      activeRef.current = false;
      readyRef.current = false;
      countingRef.current = false;
      setActive(false);
      setRevealing(false);
      setFeedback(null);
      setShowForm(false);
      setProgress(0);
      setCounting(false);
    }, FADE_MS);
  }

  // (Re)programme la révélation auto à l'échéance, une fois le contenu prêt.
  function scheduleReveal() {
    if (!activeRef.current || !readyRef.current || countingRef.current) return;
    if (revealTimer.current) clearTimeout(revealTimer.current);
    const delay = Math.max(120, deadlineRef.current - performance.now());
    revealTimer.current = setTimeout(reveal, delay);
  }

  function onStart(detail: StartDetail) {
    clearTimers();
    const fb = detail.feedback ?? null;
    activeRef.current = true;
    readyRef.current = false;
    countingRef.current = false;
    startTimeRef.current = performance.now();
    deadlineRef.current = startTimeRef.current + READ_MS;

    setFeedback(fb);
    setShowForm(!!fb);
    setProgress(0);
    setCounting(false);
    setRevealing(false);
    setSeq((s) => s + 1);
    setActive(true);

    // La barre du haut = minuteur de la fenêtre [start → deadline] (montant,
    // monotone pour ne jamais reculer si la fenêtre s'étend à l'interaction).
    progressTimer.current = setInterval(() => {
      if (countingRef.current) return;
      const span = deadlineRef.current - startTimeRef.current;
      const p = span > 0 ? ((performance.now() - startTimeRef.current) / span) * 100 : 100;
      setProgress((prev) => Math.max(prev, Math.min(99, p)));
    }, 70);

    safetyTimer.current = setTimeout(reveal, SAFETY_MS);
  }

  function onReady() {
    if (!activeRef.current) return;
    readyRef.current = true;
    scheduleReveal();
  }

  // Interaction (réaction choisie / commentaire saisi) : on rallonge la fenêtre
  // pour ne pas couper l'utilisateur en pleine saisie.
  function onActivity() {
    deadlineRef.current = Math.max(deadlineRef.current, performance.now() + ACTIVITY_GRACE);
    scheduleReveal();
  }

  function onFeedbackClose() {
    setShowForm(false);
    scheduleReveal();
  }

  // Feedback envoyé : on réutilise la barre du HAUT comme compte à rebours de
  // fermeture (elle se vide en CLOSE_MS), puis on révèle le nouveau cours.
  function onFeedbackDone() {
    countingRef.current = true;
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    progressTimer.current = null;
    safetyTimer.current = null;
    setCounting(true);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(reveal, CLOSE_MS);
  }

  // Listeners window liés une fois, mais appellent toujours le handler courant
  // (la ref est rafraîchie après chaque render via un effet, pas pendant).
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

              {/* Skeleton du contenu (toujours) + form de feedback par-dessus,
                  empilés dans la même cellule grid (la carte épouse le plus grand). */}
              <div style={{ display: "grid" }}>
                <div style={{ gridArea: "1 / 1" }}>
                  <ContentSkeleton />
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
                          onActivity={onActivity}
                          onDone={onFeedbackDone}
                          closable={false}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
