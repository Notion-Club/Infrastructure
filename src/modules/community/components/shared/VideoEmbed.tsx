"use client";

import { useState } from "react";
import type { VideoEmbedMatch } from "../../utils/video-embed";

interface VideoEmbedProps {
  // Match déjà validé (allowlist) par detectVideoEmbed — ne JAMAIS fabriquer un
  // match à partir d'une URL arbitraire non filtrée.
  match: VideoEmbedMatch;
  // Contexte pour data-fb-label (feed / détail / commentaire).
  label?: string;
}

// Cadre commun 16/9 (bord + radius + stopPropagation pour ne pas naviguer quand
// on clique le lecteur dans une carte cliquable).
function Frame({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div
      data-fb-label={label ?? "Vidéo intégrée · Communauté"}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        aspectRatio: "16 / 9",
        marginTop: 4,
        border: "1px solid var(--color-border-default)",
        background: "#000",
      }}
    >
      {children}
    </div>
  );
}

function Iframe({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  );
}

// Icône « play » (triangle plein), légèrement décalée à droite pour un centrage
// optique dans le rond.
function PlayGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true" style={{ marginLeft: 3 }}>
      <path d="M8 5.14v13.72c0 .83.91 1.34 1.62.9l10.94-6.86c.67-.42.67-1.38 0-1.8L9.62 4.24C8.91 3.8 8 4.31 8 5.14Z" />
    </svg>
  );
}

// Façade YouTube : miniature + bouton play « liquid glass » centré. Tant qu'on
// ne clique pas, AUCUN chrome YouTube (titre, boutons, suggestions) — juste
// l'image. Au clic, on bascule sur l'iframe player en autoplay.
function YouTubeFacade({ id, embedSrc, label }: { id: string; embedSrc: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState(false);
  // maxres n'existe pas pour toutes les vidéos → fallback hqdefault (toujours
  // présent) via onError.
  const [poster, setPoster] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  if (playing) {
    // rel=0 (pas de suggestions d'autres chaînes) + modestbranding + autoplay.
    return (
      <Frame label={label}>
        <Iframe src={`${embedSrc}?autoplay=1&rel=0&modestbranding=1&playsinline=1`} />
      </Frame>
    );
  }

  return (
    <Frame label={label}>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="Lire la vidéo"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          display: "block",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt=""
          onError={() => setPoster(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {/* Bouton play liquid glass : rond translucide + backdrop-blur + reflets
            (highlight interne + halo). Grossit légèrement au survol. */}
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${hover ? 1.08 : 1})`,
            width: 66,
            height: 66,
            borderRadius: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hover ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.16)",
            backdropFilter: "blur(14px) saturate(180%)",
            WebkitBackdropFilter: "blur(14px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.45)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.65), inset 0 -1px 2px rgba(255,255,255,0.15)",
            transition: "transform 220ms var(--nc-ease), background 220ms var(--nc-ease)",
          }}
        >
          <PlayGlyph />
        </span>
      </button>
    </Frame>
  );
}

// Rendu d'une vidéo de l'allowlist. YouTube → façade miniature + play custom
// (plus l'embed « tout YouTube »). Autres providers (Loom / Tella / Vimeo) →
// iframe player (Tella arrive déjà avec ses paramètres d'embed épurés).
export function VideoEmbed({ match, label }: VideoEmbedProps) {
  if (match.provider === "youtube") {
    return <YouTubeFacade id={match.id} embedSrc={match.embedSrc} label={label} />;
  }
  return (
    <Frame label={label}>
      <Iframe src={match.embedSrc} />
    </Frame>
  );
}
