interface TellaEmbedProps {
  url: string;
  // Diffère la création de l'iframe. Dans l'overlay de morph, l'iframe montée
  // AU MONTAGE (avant le layout effect d'ouverture) bloque le 1ᵉʳ paint → la
  // carte « freeze » avant de s'animer la 1ʳᵉ fois. En passant `ready={false}`
  // pendant le morph, on affiche un skeleton au MÊME ratio (aucun décalage de
  // hauteur), puis l'iframe se monte une fois l'ouverture terminée. Défaut
  // `true` → la vraie page détail (hors morph) reste inchangée.
  ready?: boolean;
}

export function TellaEmbed({ url, ready = true }: TellaEmbedProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--color-surface-raised)',
      }}
    >
      {ready ? (
        <iframe
          data-fb-label="Lecteur vidéo Tella · Embed vidéo Tella"
          src={url}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        // Skeleton pulsant, même emprise que l'iframe (ratio 16/9) → l'iframe le
        // remplace sans aucun saut de layout à l'ouverture.
        <div aria-hidden className="nc-skeleton" style={{ position: 'absolute', inset: 0 }} />
      )}
    </div>
  );
}
