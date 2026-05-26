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

const AUTO_CLOSE_MS = 12000; // fermeture auto (sécurité : le contenu est toujours chargé d'ici là)
const MIN_CROSS = 5000; // la croix de skip n'apparaît jamais avant 5 s
const ANTIFLASH = 500; // durée mini du voile sans feedback (nav précédente)
const FADE_MS = 280; // doit matcher la sortie .nc-lt-card
const CLOSE_MS = 2000; // vidage de la barre après envoi du feedback
const SAFETY_MS = 20000; // garde-fou ultime si "ready" est perdu

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
  // Barre du haut : "count" (minuteur qui se remplit sur les 12 s, façon pub
  // YouTube), "empty" (se vide = compte à rebours de fermeture après envoi).
  const [barMode, setBarMode] = useState<"count" | "empty">("count");
  const [canClose, setCanClose] = useState(false); // croix de skip visible
  const [seq, setSeq] = useState(0);

  // Valeurs lues dans des callbacks asynchrones → refs (anti stale-closure).
  const activeRef = useRef(false);
  const readyRef = useRef(false);
  const closingRef = useRef(false);
  const hasFormRef = useRef(false); // un feedback est-il affiché (vs skeleton seul) ?
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

    setFeedback(fb);
    setShowForm(!!fb);
    setProgress(0);
    setBarMode("count");
    setCanClose(false);
    setRevealing(false);
    setSeq((s) => s + 1);
    setActive(true);

    // Minuteur : la barre se remplit linéairement sur les 12 s (façon pub
    // YouTube — elle continue même une fois la croix de skip disponible).
    progressTimer.current = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const p = Math.min(100, (elapsed / AUTO_CLOSE_MS) * 100);
      setProgress((prev) => Math.max(prev, p));
    }, 60);

    // Garde-fou ultime si "ready" n'arrive jamais.
    safetyTimer.current = setTimeout(reveal, SAFETY_MS);
  }

  // Contenu prêt. Avec feedback : la croix de skip apparaît à max(ready, 5 s) et
  // la fermeture auto reste à 12 s. Sans feedback (nav précédente) : révélation
  // dès que prêt (mini ANTIFLASH).
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

  // Croix de skip cliquée (ou fermeture du form) → on révèle le nouveau cours.
  function onFeedbackClose() {
    reveal();
  }

  // Feedback envoyé : la barre du HAUT se vide (compte à rebours), puis révélation.
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

  // Quand le voile commence à se dissoudre (revealing=true), le contenu redevient
  // visible. On force un re-déclenchement de nc-mode-in (double RAF, car le
  // navigateur ne relance pas une animation sur un élément déjà monté).
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
              {/* Barre du haut : "count" (minuteur 12 s, façon pub YouTube) →
                  "empty" (se vide = compte à rebours de fermeture après envoi). */}
              <div style={{ height: 4, background: "var(--color-border-default)" }}>
                <div
                  style={{
                    height: "100%",
                    width: barMode === "empty" ? "0%" : `${progress}%`,
                    background: "var(--color-brand)",
                    transition:
                      barMode === "empty" ? `width ${CLOSE_MS}ms linear` : "width 120ms linear",
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
        </div>
      )}
    </div>
  );
}
