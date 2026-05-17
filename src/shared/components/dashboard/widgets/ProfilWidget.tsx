import { Trophy } from "lucide-react";
import { ProgressBar } from "./ProgressBar";

const MOCK_PROFIL = {
  prenom: "Théo",
  niveau: 6,
  niveauLabel: "Intermédiaire",
  niveauSuivant: "Expert",
  progressPercent: 58,
  modulesRestants: 7,
  status: "in_progress" as "in_progress" | "completed",
};

export function ProfilWidget() {
  const { niveau, niveauLabel, niveauSuivant, progressPercent, modulesRestants, status } =
    MOCK_PROFIL;
  const isCompleted = status === "completed";

  return (
    <article
      style={{
        background: "white",
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

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Trophy size={18} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            background: "rgba(224,98,90,0.08)",
            border: "1px solid rgba(224,98,90,0.2)",
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-brand)",
          }}
        >
          Niveau {niveau}
          <span style={{ opacity: 0.4, margin: "0 1px" }}>|</span>
          {niveauLabel}
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
      ) : (
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Il te reste <strong style={{ color: "var(--color-text-primary)" }}>{modulesRestants} modules</strong>
          <br />
          pour atteindre <strong style={{ color: "var(--color-text-primary)" }}>{niveauSuivant}</strong>.
        </p>
      )}

      <ProgressBar
        percent={isCompleted ? 100 : progressPercent}
        from={`Niveau ${niveau}`}
        to={`Niveau ${niveau + 1}`}
      />
    </article>
  );
}
