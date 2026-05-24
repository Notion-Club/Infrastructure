"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { FeedbackBody } from "./LessonFeedback";

export type LessonFeedbackDetail = {
  courseName: string;
  formationName: string;
  moduleName: string;
};

const EVENT = "nc:lesson-feedback";

// Émis par la navigation de leçon à la première complétion d'un cours.
// La pop-up vit dans le layout /formation → elle survit au changement de
// route et fait le pont pendant le chargement du cours suivant.
export function emitLessonFeedback(detail: LessonFeedbackDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<LessonFeedbackDetail>(EVENT, { detail }));
}

// Pop-up de coin (notification, sans overlay) montée une fois dans le layout.
export function LessonFeedbackPrompt() {
  const [data, setData] = useState<LessonFeedbackDetail | null>(null);
  const [closing, setClosing] = useState(false);
  const [seq, setSeq] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onEvent(e: Event) {
      const detail = (e as CustomEvent<LessonFeedbackDetail>).detail;
      if (!detail) return;
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setClosing(false);
      setSeq((s) => s + 1);
      setData(detail);
    }
    window.addEventListener(EVENT, onEvent);
    return () => {
      window.removeEventListener(EVENT, onEvent);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function dismiss() {
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setData(null);
      setClosing(false);
    }, 230);
  }

  if (!data || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-label="Donner un feedback sur le cours"
      className="nc-feedback-corner"
      data-closing={closing}
      style={{
        position: "fixed",
        zIndex: 9998,
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 18,
        boxShadow: "var(--nc-shadow-3)",
        overflow: "hidden",
      }}
    >
      <FeedbackBody
        key={seq}
        courseName={data.courseName}
        formationName={data.formationName}
        moduleName={data.moduleName}
        onClose={dismiss}
      />
    </div>,
    document.body,
  );
}
