import { Trophy } from "lucide-react";
import { ProgressBar } from "./ProgressBar";

// Données live injectées par le dashboard server (getDashboardProfilData).
// Le widget reste 100% présentationnel — le niveau (1..9) et le label nommé
// sont calculés côté server à partir du nombre de modules entièrement
// complétés, formule alignée sur le système Notion historique de Théo.
//
// Quand data === null → l'user n'a aucune formation accessible. Widget masqué.
export interface ProfilWidgetData {
  level: number; // 1..9
  levelLabel: string; // "Débutant", "Explorateur", "Stratège", etc.
  status: "not_started" | "in_progress" | "completed";
  modulesCompleted: number;
  modulesTotal: number;
}

interface ProfilWidgetProps {
  data?: ProfilWidgetData | null;
}

// Fallback mock — pour les aperçus dev sans Supabase.
const FALLBACK: ProfilWidgetData = {
  level: 5,
  levelLabel: "Architecte",
  status: "in_progress",
  modulesCompleted: 6,
  modulesTotal: 11,
};

// Copie inspirée de la formule Notion de Théo — adaptée pour un widget.
function buildSubtitle(data: ProfilWidgetData): string {
  const { status, modulesCompleted, modulesTotal } = data;
  if (status === "completed") {
    return "Tu as tout terminé, félicitations !";
  }
  if (modulesCompleted === 0) {
    return "Aucun module terminé, let's go commencer !";
  }
  const remaining = modulesTotal - modulesCompleted;
  if (modulesCompleted === 1) {
    return `Tu as terminé 1 module, plus que ${remaining} à faire.`;
  }
  if (remaining === 1) {
    return "Tu as presque terminé, plus qu'un dernier module !";
  }
  return `Tu as terminé ${modulesCompleted} modules, plus que ${remaining} à faire.`;
}

export function ProfilWidget({ data }: ProfilWidgetProps = {}) {
  if (data === null) return null;
  const view = data ?? FALLBACK;
  const { level, levelLabel, status, modulesCompleted, modulesTotal } = view;
  const isCompleted = status === "completed";
  // Barre de progression : ratio modules complétés / total.
  const percent =
    modulesTotal === 0
      ? 0
      : Math.round((modulesCompleted / modulesTotal) * 100);
  const subtitle = buildSubtitle(view);

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

      <p
        style={{
          fontSize: 14,
          color: isCompleted
            ? "var(--color-brand)"
            : "var(--color-text-secondary)",
          fontWeight: isCompleted ? 500 : 400,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        {subtitle}
      </p>

      <ProgressBar
        percent={percent}
        from={`${percent}%`}
        to={`${modulesCompleted} / ${modulesTotal} modules`}
      />
    </article>
  );
}
