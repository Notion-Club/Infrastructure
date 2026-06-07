import { Trophy } from "lucide-react";
import { ProgressBar } from "./ProgressBar";

// Données live injectées par le dashboard server (getDashboardProfilData).
// Le widget reste 100% présentationnel — le niveau, le palier suivant et le
// nombre de modules restants sont calculés côté server à partir du % agrégé
// sur toutes les formations accessibles à l'user.
//
// Quand data est null → l'user n'a aucune formation accessible. On retourne
// null pour ne pas afficher un encadré vide.
export interface ProfilWidgetData {
  level: number;
  levelLabel: "Débutant" | "Intermédiaire" | "Expert";
  nextLevelLabel: "Intermédiaire" | "Expert" | null;
  progressToNextLevel: number;
  coursesRemaining: number;
  status: "not_started" | "in_progress" | "completed";
}

interface ProfilWidgetProps {
  data?: ProfilWidgetData | null;
}

// Fallback mock — conservé pour les aperçus dev sans Supabase. En production
// le dashboard passe toujours `data`.
const FALLBACK: ProfilWidgetData = {
  level: 6,
  levelLabel: "Intermédiaire",
  nextLevelLabel: "Expert",
  progressToNextLevel: 58,
  coursesRemaining: 7,
  status: "in_progress",
};

export function ProfilWidget({ data }: ProfilWidgetProps = {}) {
  if (data === null) return null;
  const {
    level,
    levelLabel,
    nextLevelLabel,
    progressToNextLevel,
    coursesRemaining,
    status,
  } = data ?? FALLBACK;
  const isCompleted = status === "completed";
  const isNotStarted = status === "not_started";

  return (
    <article
      data-fb-label="Encadré Profil · Tableau de bord"
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "var(--nc-shadow-3)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}
      >
        Mon profil
      </span>

      <div>
        <span
          data-fb-label="Badge Niveau · Widget Profil"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 12px 5px 10px",
            background: "rgba(224,98,90,0.08)",
            border: "1px solid rgba(224,98,90,0.2)",
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-brand)",
          }}
        >
          <Trophy size={14} style={{ flexShrink: 0 }} />
          Niveau {level}
          <span style={{ opacity: 0.4, margin: "0 1px" }}>|</span>
          {levelLabel}
        </span>
      </div>

      {isCompleted ? (
        <p
          style={{
            fontSize: 14,
            color: "var(--color-brand)",
            fontWeight: 500,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Tu as tout terminé, félicitations&nbsp;! 🎉
        </p>
      ) : isNotStarted ? (
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Lance ta formation pour progresser vers{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>
            {nextLevelLabel ?? "Expert"}
          </strong>
          .
        </p>
      ) : (
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Il te reste{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>
            {coursesRemaining} {coursesRemaining > 1 ? "cours" : "cours"}
          </strong>{" "}
          pour atteindre{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>
            {nextLevelLabel ?? "le niveau suivant"}
          </strong>
          .
        </p>
      )}

      <ProgressBar
        percent={isCompleted ? 100 : progressToNextLevel}
        from={`Niveau ${level}`}
        to={`Niveau ${Math.min(10, level + 1)}`}
      />
    </article>
  );
}
