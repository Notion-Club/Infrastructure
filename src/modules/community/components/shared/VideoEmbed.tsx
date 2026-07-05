"use client";

interface VideoEmbedProps {
  // Source d'embed déjà validée (allowlist) par detectVideoEmbed — ne JAMAIS
  // passer une URL arbitraire non filtrée ici.
  src: string;
  // Contexte pour data-fb-label (feed / détail / commentaire).
  label?: string;
}

// Iframe player responsive 16/9. stopPropagation sur le conteneur pour qu'un
// clic sur le lecteur (dans une carte cliquable du feed) n'entraîne pas la
// navigation vers la page détail.
export function VideoEmbed({ src, label }: VideoEmbedProps) {
  return (
    <div
      data-fb-label={label ?? "Vidéo intégrée · Communauté"}
      onClick={(e) => e.stopPropagation()}
      style={{
        borderRadius: 12,
        overflow: "hidden",
        aspectRatio: "16 / 9",
        marginTop: 4,
        border: "1px solid var(--color-border-default)",
      }}
    >
      <iframe
        src={src}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
