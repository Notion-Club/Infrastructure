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

const MIN_CROSS = 5000; // la croix de skip n'apparaît jamais avant 5 s — ni avant que le contenu soit prêt
const ANTIFLASH = 500; // durée mini du voile sans feedback (nav précédente)
const FADE_MS = 280; // doit matcher la sortie .nc-lt-card
const CLOSE_MS = 2000; // vidage de la barre après envoi du feedback
const SAFETY_MS = 30000; // garde-fou ultime si le signal "ready" n'arrive jamais

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

// Barre de progression du haut. Remplissage FLUIDE via un seul tween CSS
// (transform: scaleX, composité GPU — aucun layout) au lieu d'un setInterval qui
// re-settait la largeur toutes les 60 ms contre une transition de 120 ms : les
// deux se télescopaient → saccades. Un seul tween continu = progression lisse.
//   • count (chargement)  : 0 → 90 % sur MIN_CROSS, façon pub YouTube ;
//   • complete (prêt)      : 90 → 100 % rapide ;
//   • empty (après envoi)  : 100 → 0 % sur CLOSE_MS.
function LessonProgressBar({
  mode,
  complete,
}: {
  mode: "count" | "empty";
  complete: boolean;
}) {
  const [scale, setScale] = useState(0);

  useEffect(() => {
    // Cible : empty → 0, prêt → 100 %, sinon remplissage → 90 %. setState déféré
    // au frame suivant (règle react-hooks/set-state-in-effect du repo) — ce qui
    // amorce aussi la transition CSS depuis le 0 initial déjà peint.
    const target = mode === "empty" ? 0 : complete ? 1 : 0.9;
    const raf = requestAnimationFrame(() => setScale(target));
    return () => cancelAnimationFrame(raf);
  }, [mode, complete]);

  const transition =
    mode === "empty"
      ? `transform ${CLOSE_MS}ms linear`
      : complete
        ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
        : `transform ${MIN_CROSS}ms cubic-bezier(0.33, 0.1, 0.25, 1)`;

  return (
    <div style={{ height: 4, background: "var(--color-border-default)", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: "100%",
          transformOrigin: "left",
          transform: `scaleX(${scale})`,
          background: "var(--color-brand)",
          transition,
          willChange: "transform",
        }}
      />
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
  // Barre du haut : "count" (remplissage fluide sur MIN_CROSS, façon pub
  // YouTube), "empty" (se vide = compte à rebours de fermeture après envoi).
  // `barComplete` complète le remplissage (→ 100 %) quand le cours est prêt.
  const [barComplete, setBarComplete] = useState(false);
  const [barMode, setBarMode] = useState<"count" | "empty">("count");
  const [seq, setSeq] = useState(0);

  // Valeurs lues dans des callbacks asynchrones → refs (anti stale-closure).
  const activeRef = useRef(false);
  const readyRef = useRef(false);
  const closingRef = useRef(false);
  const hasFormRef = useRef(false); // un feedback est-il affiché (vs skeleton seul) ?
  const startTimeRef = useRef(0);

  const contentRef = useRef<HTMLDivElement>(null);

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crossTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (crossTimer.current) clearTimeout(crossTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
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
      setBarComplete(false);
      setBarMode("count");
    }, FADE_MS);
  }

  // Auto-avance : le contenu est prêt ET le minimum de 5 s est écoulé (barre de
  // progression pleine). On complète la barre puis on enchaîne tout seul sur le
  // cours suivant — l'utilisateur n'est plus bloqué derrière une croix.
  function autoAdvance() {
    if (!activeRef.current || closingRef.current) return;
    if (crossTimer.current) clearTimeout(crossTimer.current);
    crossTimer.current = null;
    setBarComplete(true);
    reveal();
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
    setBarComplete(false);
    setBarMode("count");
    setRevealing(false);
    setSeq((s) => s + 1);
    setActive(true);

    // La barre se remplit toute seule (CSS, 0 → 90 % sur MIN_CROSS) ; le solde
    // (→ 100 %) est posé par autoAdvance/onReady quand le cours est prêt.

    // Garde-fou ultime si "ready" n'arrive jamais.
    safetyTimer.current = setTimeout(reveal, SAFETY_MS);
  }

  // Contenu prêt. Avec feedback : le cours suivant s'affiche automatiquement à
  // max(5 s, ready) — le temps d'attente a servi à charger entièrement le cours
  // et à proposer le feedback, mais l'utilisateur n'est jamais bloqué. Sans
  // feedback (nav précédente) : révélation dès que prêt (mini ANTIFLASH).
  function onReady() {
    if (!activeRef.current || readyRef.current) return;
    readyRef.current = true;
    // Le contenu est arrivé → le garde-fou anti-signal-perdu n'a plus lieu d'être.
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = null;
    const elapsed = performance.now() - startTimeRef.current;
    if (hasFormRef.current) {
      // Dès que le cours est prêt ET la barre pleine (max 5 s, ready), on enchaîne
      // tout seul. Le feedback reste envoyable pendant le chargement, mais ne
      // barre plus l'accès au cours suivant.
      if (crossTimer.current) clearTimeout(crossTimer.current);
      crossTimer.current = setTimeout(autoAdvance, Math.max(0, MIN_CROSS - elapsed));
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
    if (crossTimer.current) clearTimeout(crossTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
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
              {/* Barre du haut — remplissage fluide (un seul tween CSS scaleX). */}
              <LessonProgressBar key={seq} mode={barMode} complete={barComplete} />

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
