interface TellaEmbedProps {
  url: string;
}

export function TellaEmbed({ url }: TellaEmbedProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <iframe
        data-fb-label="Lecteur vidéo Tella · Embed vidéo Tella"
        src={url}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
