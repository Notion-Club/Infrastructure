"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, SmilePlus, X } from "lucide-react";

import { submitCourseFeedback } from "../server/actions";

type Props = {
  courseName: string;
  formationName: string;
  moduleName: string;
};

// Réactions = options exactes du select « Avis » de la base Notion Feedbacks.
export const AVIS = [
  "👍 C'est clair",
  "😊 Ça m'a beaucoup aidé!",
  "😬 Je n'ai rien compris - c'était confus",
  "🤔 Pas tout compris certains points restent flous",
  "🥱 J'ai compris - mais je ne vois pas la pertinence",
];

type Phase = "form" | "sending" | "done";

// Pill + modale centrée (déclenchée manuellement depuis l'en-tête du cours).
export function LessonFeedback({ courseName, formationName, moduleName }: Props) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openPopup() {
    setClosing(false);
    setOpen(true);
  }
  function close() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Joue l'animation de sortie, puis démonte.
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 210);
  }

  return (
    <>
      {/* Pill déclencheur dans la ligne du titre */}
      <button
        type="button"
        onClick={openPopup}
        data-fb-label="Bouton Un feedback ? · Lecteur de leçon"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          flexShrink: 0,
          padding: "7px 14px 7px 12px",
          borderRadius: 9999,
          border: "1px solid var(--color-border-default)",
          background: "var(--color-surface-raised)",
          color: "var(--color-text-secondary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "border-color 200ms ease, color 200ms ease",
        }}
        className="hover:border-[rgba(224,98,90,0.4)] hover:text-[var(--color-brand)]"
      >
        <SmilePlus size={16} style={{ color: "var(--color-brand)" }} />
        Un feedback ?
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              onClick={close}
              className="nc-pop-overlay"
              data-closing={closing}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(2px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="nc-pop-card"
                data-closing={closing}
                data-fb-label="Modale feedback leçon · Lecteur de leçon"
                style={{
                  width: "100%",
                  maxWidth: 460,
                  background: "var(--color-surface-card)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 20,
                  boxShadow: "var(--nc-shadow-2)",
                  overflow: "hidden",
                }}
              >
                <FeedbackBody
                  courseName={courseName}
                  formationName={formationName}
                  moduleName={moduleName}
                  onClose={close}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

// Corps partagé du feedback : réactions + commentaire + envoi + panneau de
// remerciement. Réutilisé par la modale (pill) et par la pop-up de coin.
export function FeedbackBody({
  courseName,
  formationName,
  moduleName,
  onClose,
  onDone,
  closable = true,
}: {
  courseName: string;
  formationName: string;
  moduleName: string;
  onClose: () => void;
  onDone?: () => void;
  closable?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [avis, setAvis] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  async function submit() {
    if (!avis) return;
    setPhase("sending");
    await submitCourseFeedback({
      avis,
      suggestion: comment,
      courseName,
      formationName,
      moduleName,
    });
    setPhase("done");
    // Mode externe (voile de transition) : la fermeture est pilotée par le
    // parent qui réutilise la barre du haut. Sinon (modale pill) : auto-close 2s.
    if (onDone) {
      onDone();
    } else {
      doneTimer.current = setTimeout(onClose, 2000);
    }
  }

  if (phase === "done") return <DonePanel showCountdown={!onDone} />;

  return (
    <div data-fb-label="Formulaire feedback leçon · Modale feedback" style={{ padding: 22 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          Qu&apos;as-tu pensé de cette vidéo ?
        </h3>
        {closable && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            className="nc-fade-in hover:bg-[var(--color-surface-raised)]"
          >
            <X size={17} />
          </button>
        )}
      </header>

      {/* Tags réaction */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {AVIS.map((label) => {
          const active = avis === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setAvis(label)}
              data-fb-label={`Réaction « ${label} » · Formulaire feedback leçon`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                borderRadius: 12,
                border: "1px solid",
                borderColor: active
                  ? "var(--color-brand)"
                  : "var(--color-border-default)",
                background: active
                  ? "rgba(224,98,90,0.08)"
                  : "var(--color-surface-raised)",
                color: "var(--color-text-primary)",
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 150ms ease, background 150ms ease",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Deuxième question — révélée en douceur au choix d'une réaction */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: avis ? "1fr" : "0fr",
          transition: "grid-template-rows 300ms var(--nc-ease)",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div style={{ paddingTop: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: 8,
              }}
            >
              As-tu un commentaire à nous partager ?
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 1900))}
              placeholder="Optionnel : ton retour nous aide à améliorer le Notion Club."
              rows={3}
              data-fb-label="Champ commentaire feedback · Formulaire feedback leçon"
              style={{
                width: "100%",
                border: "1px solid var(--color-border-default)",
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--color-text-primary)",
                background: "var(--color-surface-raised)",
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
              }}
              className="focus:border-[rgba(224,98,90,0.4)]"
            />
            <button
              type="button"
              onClick={submit}
              disabled={phase === "sending"}
              data-fb-label="Bouton Envoyer mon feedback · Formulaire feedback leçon"
              style={{
                marginTop: 12,
                width: "100%",
                background: "var(--color-brand)",
                color: "white",
                border: "none",
                borderRadius: 9999,
                padding: "12px 18px",
                fontSize: 14,
                fontWeight: 700,
                cursor: phase === "sending" ? "wait" : "pointer",
                opacity: phase === "sending" ? 0.7 : 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {phase === "sending" ? "Envoi…" : "Envoyer mon feedback"}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DonePanel({ showCountdown = true }: { showCountdown?: boolean }) {
  return (
    <div
      style={{
        padding: showCountdown ? "32px 24px 0" : "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
      }}
    >
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "rgba(224,98,90,0.12)",
          color: "var(--color-brand)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={26} strokeWidth={2.5} />
      </span>
      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--color-text-primary)",
          margin: 0,
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        Merci pour ton retour, on est à l&apos;écoute pour améliorer le Notion Club
      </p>
      {/* Barre de fermeture auto (modale pill uniquement). Dans le voile de
          transition, c'est la barre du haut qui sert de compte à rebours. */}
      {showCountdown && (
        <div
          style={{
            width: "100%",
            height: 3,
            background: "var(--color-border-default)",
            marginTop: 18,
            overflow: "hidden",
          }}
        >
          <div className="nc-feedback-countdown" style={{ height: "100%", background: "var(--color-brand)" }} />
        </div>
      )}
    </div>
  );
}
