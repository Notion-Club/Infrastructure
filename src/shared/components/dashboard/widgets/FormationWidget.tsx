"use client";

import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { ProgressBar } from "./ProgressBar";

// Données live injectées par le dashboard server component
// (getDashboardFormationData). Le widget reste 100% présentationnel — toute la
// logique métier (sélection du programme à afficher, % global, "Reprendre où
// j'en étais") est calculée côté server.
//
// Quand data est null → l'user n'a aucune formation accessible. On retourne
// null pour laisser le slot vide (le dashboard place déjà un placeholder
// "Communauté · Coaching · à venir" dans cette zone).
export interface FormationWidgetData {
  programSlug: string;
  programName: string;
  totalCourses: number;
  completedCourses: number;
  percent: number;
  resumeHref: string | null;
  nextCourseLabel: string | null;
}

interface FormationWidgetProps {
  // Si non fourni → fallback sur les anciens mocks pour préserver l'aperçu
  // visuel pendant que Théo travaille hors connexion. En prod le dashboard
  // passe toujours data (potentiellement null).
  data?: FormationWidgetData | null;
}

// Fallback mock — conservé pour les aperçus Storybook / dev mode sans Supabase.
// En production le dashboard passe systématiquement `data`.
const FALLBACK: FormationWidgetData = {
  programSlug: "devenir-consultant-notion",
  programName: "Module 6 — Bases de données avancées",
  totalCourses: 12,
  completedCourses: 5,
  percent: 58,
  resumeHref: "/formation",
  nextCourseLabel: "Vidéo 3 / 5",
};

export function FormationWidget({ data }: FormationWidgetProps = {}) {
  const router = useRouter();

  // data === null = pas de formation accessible → widget masqué
  if (data === null) return null;

  const view = data ?? FALLBACK;
  const formationUrl = `/formation/${view.programSlug}`;
  const resumeUrl = view.resumeHref ?? formationUrl;
  const remaining = Math.max(0, view.totalCourses - view.completedCourses);
  // Sous-titre dynamique : "prochain cours" si l'API le fournit (cas
  // "Reprendre où j'en étais"), sinon état lisible selon la progression.
  const subtitle = view.nextCourseLabel
    ? `Prochain cours : ${view.nextCourseLabel}`
    : view.completedCourses === 0
      ? "Démarre quand tu veux"
      : view.completedCourses >= view.totalCourses
        ? "Formation terminée 🎉"
        : `${view.completedCourses} / ${view.totalCourses} cours complétés`;

  return (
    <article
      onClick={() => router.push(formationUrl)}
      data-fb-label="Encadré Formation · Tableau de bord"
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "var(--nc-shadow-3)",
        cursor: "pointer",
        transition: "border-color 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "relative",
        overflow: "hidden",
      }}
      className="group hover:border-[rgba(224,98,90,0.32)]"
    >
      <div
        aria-hidden
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 180,
          height: 180,
          pointerEvents: "none",
          backgroundImage:
            "radial-gradient(circle, var(--nc-card-dot-color) 1px, transparent 1.4px)",
          backgroundSize: "11px 11px",
          maskImage:
            "radial-gradient(circle at top right, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(circle at top right, black 0%, transparent 70%)",
        }}
      />
      <span
        style={{
          position: "relative",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}
      >
        Formation en cours
      </span>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {view.programName}
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>
          {subtitle}
        </p>
      </div>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
        <ProgressBar percent={view.percent} />
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
          {view.completedCourses} cours complétés · {remaining} restants
        </p>
      </div>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(resumeUrl);
          }}
          data-fb-label="Bouton Reprendre · Widget Formation"
          style={{
            background: "var(--color-brand)",
            color: "white",
            borderRadius: 9999,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            cursor: "pointer",
            transition: "transform 200ms ease, box-shadow 200ms ease",
          }}
          className="hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_rgba(224,98,90,0.4)]"
        >
          <Play size={13} fill="currentColor" strokeWidth={0} />
          Reprendre
        </button>
      </div>
    </article>
  );
}
