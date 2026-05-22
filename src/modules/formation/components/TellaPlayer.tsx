"use client";

import { Play } from "lucide-react";

type Props = {
  videoUrl: string | null;
  durationSeconds: number | null;
  title: string;
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Placeholder visuel pour le lecteur Tella. La maquette n'embarque pas
// l'iframe réel pour rester lisible — un play button centré + un faux
// thumbnail dégradé suffisent. Brique 2 réel branchera <iframe src={...}>.
export function TellaPlayer({ videoUrl, durationSeconds, title }: Props) {
  if (!videoUrl) return null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: "linear-gradient(135deg, #1f1c1c 0%, #2d2828 100%)",
        borderRadius: 18,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "var(--nc-shadow-2)",
      }}
      role="button"
      aria-label={`Lire la vidéo : ${title}`}
    >
      {/* Gradient overlay halo brand subtil pour rappeler la DA */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 30% 30%, rgba(224,98,90,0.20) 0%, transparent 50%)",
        }}
      />

      {/* Play button */}
      <div
        style={{
          position: "relative",
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.95)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          transition: "transform 200ms ease",
        }}
        className="hover:scale-105"
      >
        <Play
          size={28}
          fill="var(--color-text-primary)"
          strokeWidth={0}
          style={{ marginLeft: 4 }}
        />
      </div>

      {/* Duration pill */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          background: "rgba(0,0,0,0.65)",
          color: "white",
          fontSize: 12,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 9999,
          backdropFilter: "blur(8px)",
        }}
      >
        {formatDuration(durationSeconds)}
      </div>

      {/* Tella mark */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(8px)",
          color: "rgba(255,255,255,0.7)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "4px 10px",
          borderRadius: 9999,
        }}
      >
        Tella · embed placeholder
      </div>
    </div>
  );
}
